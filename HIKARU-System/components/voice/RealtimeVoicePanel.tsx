'use client'
// ============================================================
// RealtimeVoicePanel — OpenAI Realtime Voice (WebRTC) for System
// HIKARU Tool Registry と接続した本番 Realtime 経路。
// Ephemeral Token + WebRTC 接続。API Key をブラウザへ露出しない。
// Write操作は /api/ai/confirm-action 経由でServer Auth 再検証。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSystemJarvis }       from '@/lib/voice/SystemVoiceContext'
import { VOICE_ASSISTANT_NAME }  from '@/lib/voice/config'
import { X, Radio, Mic }        from 'lucide-react'

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

type RealtimeSession = any
type RealtimeAgent   = any

async function loadRealtimeSDK(): Promise<{ RealtimeAgent: any; RealtimeSession: any }> {
  const mod = await import('@openai/agents/realtime')
  return { RealtimeAgent: mod.RealtimeAgent, RealtimeSession: mod.RealtimeSession }
}

export type RealtimeVoiceStatus = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error'

interface RealtimeVoicePanelProps {
  onStatusChange?: (status: RealtimeVoiceStatus) => void
  onClose:         () => void
}

const REALTIME_MODEL = 'gpt-4o-realtime-preview'

const SYSTEM_PROMPT_RT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。

## 言語
必ず日本語で回答。2〜3文以内で簡潔に。

## 役割
- 今日の作業・案件の確認と案内
- マニュアル・手順書の情報提供
- スケジュール・勤怠・経費のサマリー確認
- 必要なページへのナビゲーション
- 業務操作（出勤・退勤・作業開始・完了等）の安全な実行支援

## Write操作のルール（最重要）
L3/L4操作は必ずユーザーの確認を取ってから execute_confirmed_action を呼ぶ。
確認前に実行ツールを呼ばない。

フロー:
1. ユーザーが「打刻して」「出勤」等と言う
2. JARVIS: 「出勤を打刻します。よろしいですか？」
3. ユーザーが「はい」「そうです」等と言う
4. execute_confirmed_action({ action: 'system.clock_in', params: {} }) を呼ぶ
5. Tool結果が success なら発話。failed なら正確に失敗を伝える。

## execute_confirmed_actionのaction一覧
- system.clock_in      出勤打刻（params: {}）
- system.clock_out     退勤打刻（params: {}）
- system.start_job     作業開始（params: { projectId }）
- system.complete_job  作業完了（params: { jobId } または { projectId }）
- system.submit_expense 経費申請（params: { expenseId }）
- system.mark_notification_read 通知既読（params: { notificationId }）

## 失敗時
Tool結果のerrorをそのまま読み上げる。成功したふりをしない。`

// ─── Browser-side HIKARU Tools (credentials: 'include' でAuth) ─
async function hikaruFetch(path: string): Promise<any> {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

function buildRealtimeTools(router: ReturnType<typeof useRouter>, projectIdRef: React.MutableRefObject<string | undefined>) {
  return [
    {
      name:        'get_today_jobs',
      description: '今日の担当作業・案件一覧を取得する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await hikaruFetch('/api/home/data')
        if (!data) return '今日の作業情報を取得できませんでした。'
        const projects: Array<{ id: string; name: string }> = data.projects ?? []
        if (projects.length === 0) return '今日の担当作業はありません。'
        const list = projects.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} [id:${p.id}]`).join(', ')
        return `今日は${projects.length}件あります。${list}`
      },
    },
    {
      name:        'get_notifications',
      description: '通知・未読件数とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await hikaruFetch('/api/notifications')
        if (!data) return '通知を取得できませんでした。'
        const list = Array.isArray(data?.data) ? data.data : []
        const unread = list.filter((n: any) => !n.is_read)
        if (unread.length === 0) return '未読の通知はありません。'
        const items = unread.slice(0, 3).map((n: any, i: number) => `${i + 1}: ${n.title ?? n.body ?? '通知'} [id:${n.id}]`).join(', ')
        return `未読${unread.length}件。${items}`
      },
    },
    {
      name:        'get_schedule',
      description: '今後のスケジュールを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await hikaruFetch('/api/schedule')
        if (!data) return 'スケジュールを取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        return items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`
      },
    },
    {
      name:        'get_attendance',
      description: '今日の勤怠・打刻状況を確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await hikaruFetch('/api/attendance')
        if (!data) return '勤怠情報を取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        const today = items[0] as any
        if (!today) return '本日の勤怠記録はありません。'
        const ci = today.clock_in ? new Date(today.clock_in).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '未打刻'
        const co = today.clock_out ? new Date(today.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '未打刻'
        return `本日: 出勤${ci} / 退勤${co}。`
      },
    },
    {
      name:        'get_expense_summary',
      description: '提出可能な経費申請（下書き）一覧とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await hikaruFetch('/api/expenses')
        if (!data) return '経費情報を取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        const drafts = items.filter((e: any) => e.status === 'draft')
        if (drafts.length === 0) return '提出可能な経費申請はありません。'
        const list = drafts.slice(0, 3).map((e: any, i: number) => `${i + 1}: ${e.title ?? `¥${e.amount}`} [id:${e.id}]`).join(', ')
        return `提出可能な経費申請${drafts.length}件。${list}`
      },
    },
    {
      name:        'get_active_job',
      description: '今日の進行中作業のjobIdを取得する（complete_jobで必要）',
      parameters:  { type: 'object', properties: { projectId: { type: 'string' } }, required: [] },
      execute:     async ({ projectId }: { projectId?: string }) => {
        const pid = projectId || projectIdRef.current
        const today = new Date().toISOString().split('T')[0]
        const path = pid ? `/api/jobs?projectId=${pid}&status=in_progress&date=${today}` : `/api/jobs?status=in_progress&date=${today}`
        const data = await hikaruFetch(path)
        const jobs = Array.isArray(data?.data) ? data.data : []
        const active = jobs.filter((j: any) => j.status === 'in_progress')
        if (active.length === 0) return '進行中の作業はありません。'
        return `進行中の作業 [jobId:${active[0].id}]`
      },
    },
    {
      name:        'navigate',
      description: '指定のページへ移動する',
      parameters:  {
        type:       'object',
        properties: {
          path:      { type: 'string', description: '/home, /jobs, /jobs/[id], /attendance, /expenses, /notifications, /schedule, /shifts, /profile 等' },
          projectId: { type: 'string', description: '案件ページへ移動する場合のID' },
        },
        required: ['path'],
      },
      execute: async ({ path, projectId }: { path: string; projectId?: string }) => {
        const target = projectId ? path.replace('[id]', projectId) : path
        router.push(target)
        return `${target}へ移動します。`
      },
    },
    {
      name:        'execute_confirmed_action',
      description: 'ユーザーが「はい」と確認した後にのみ呼ぶ。HIKARU業務操作をServer Authで実行する。',
      parameters:  {
        type:       'object',
        properties: {
          action: {
            type: 'string',
            enum: ['system.clock_in', 'system.clock_out', 'system.start_job', 'system.complete_job', 'system.submit_expense', 'system.mark_notification_read'],
          },
          params: { type: 'object', description: 'jobId / projectId / expenseId / notificationId 等' },
        },
        required: ['action'],
      },
      execute: async ({ action, params = {} }: { action: string; params?: Record<string, string> }) => {
        const res = await fetch('/api/ai/confirm-action', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({
            action,
            params,
            safetyLevel: 3,
            expiresAt:   Date.now() + 90_000, // 90s（即時確認なので短め）
          }),
        })
        const data = await res.json()
        if (!res.ok) return data.error ?? '実行に失敗しました。'
        return data.voiceReply ?? '完了しました。'
      },
    },
  ]
}

export function RealtimeVoicePanel({ onStatusChange, onClose }: RealtimeVoicePanelProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const jarvis   = useSystemJarvis()

  const [status,     setStatus]     = React.useState<RealtimeVoiceStatus>('idle')
  const [error,      setError]      = React.useState<string>('')
  const [transcript, setTranscript] = React.useState<string>('')

  const sessionRef    = React.useRef<RealtimeSession | null>(null)
  const isMounted     = React.useRef(true)
  const projectIdRef  = React.useRef<string | undefined>(undefined)

  // 現在の案件 ID を URL から取得
  React.useEffect(() => {
    const match = pathname.match(/\/jobs\/([^/]+)/)
    projectIdRef.current = match?.[1]
  }, [pathname])

  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      sessionRef.current?.close?.()
    }
  }, [])

  const updateStatus = React.useCallback((s: RealtimeVoiceStatus) => {
    if (!isMounted.current) return
    setStatus(s)
    onStatusChange?.(s)
  }, [onStatusChange])

  const connect = React.useCallback(async () => {
    if (status === 'connecting' || status === 'connected' || status === 'listening' || status === 'speaking') return
    updateStatus('connecting')
    setError('')

    try {
      // 1. Server から Ephemeral Token 取得
      const tokenRes = await fetch('/api/ai/realtime-token', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ model: REALTIME_MODEL }),
      })
      if (!tokenRes.ok) throw new Error('Ephemeral token の取得に失敗しました。')
      const { clientSecret } = await tokenRes.json()
      if (!clientSecret) throw new Error('Ephemeral token が空です。')

      // 2. Realtime SDK 動的インポート
      const { RealtimeAgent, RealtimeSession } = await loadRealtimeSDK()

      // 3. ツール定義（ブラウザ側 HIKARU Tool）
      const tools = buildRealtimeTools(router, projectIdRef)

      // 4. RealtimeAgent + Tools
      const agent: RealtimeAgent = new RealtimeAgent({
        name:         'JARVIS Worker Realtime',
        instructions: SYSTEM_PROMPT_RT,
        model:        REALTIME_MODEL,
        tools,
      })

      // 5. Session 作成 + WebRTC 接続
      const session: RealtimeSession = new RealtimeSession(agent, { model: REALTIME_MODEL })

      session.on?.('connected',             () => { if (isMounted.current) updateStatus('connected') })
      session.on?.('disconnected',          () => { if (isMounted.current) { updateStatus('idle'); sessionRef.current = null } })
      session.on?.('error',                 (err: Error) => { if (isMounted.current) { setError(err?.message ?? '接続エラー'); updateStatus('error') } })
      session.on?.('agent_start_speech',    () => { if (isMounted.current) updateStatus('speaking') })
      session.on?.('agent_end_speech',      () => { if (isMounted.current) updateStatus('listening') })
      session.on?.('user_start_speech',     () => { if (isMounted.current) updateStatus('listening') })
      session.on?.('user_transcription_done', (text: string) => { if (isMounted.current) setTranscript(text) })

      await session.connect({ apiKey: clientSecret })
      sessionRef.current = session
      if (isMounted.current) updateStatus('connected')

    } catch (err) {
      console.error('[realtime]', err)
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Realtimeに接続できませんでした。')
        updateStatus('error')
      }
    }
  }, [status, router, updateStatus])

  const disconnect = React.useCallback(() => {
    sessionRef.current?.close?.()
    sessionRef.current = null
    updateStatus('idle')
    setError('')
    setTranscript('')
  }, [updateStatus])

  const handleClose = () => { disconnect(); onClose() }

  const statusLabel = {
    idle:       'タップして開始',
    connecting: '接続中...',
    connected:  'LISTENING',
    listening:  'LISTENING',
    speaking:   'SPEAKING',
    error:      'エラー',
  }[status]

  const dotColor = {
    idle:       GD,
    connecting: 'oklch(0.70 0.20 55)',
    connected:  '#4ade80',
    listening:  '#4ade80',
    speaking:   GB,
    error:      'oklch(0.78 0.24 22)',
  }[status]

  const isActive = status === 'connected' || status === 'listening'

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ background: 'oklch(0.04 0.002 260 / 0.97)', backdropFilter: 'blur(8px)' }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${G}20` }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: dotColor, boxShadow: isActive ? `0 0 8px ${dotColor}` : undefined }} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: GB }}>
            {VOICE_ASSISTANT_NAME} REALTIME
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase" style={{ color: GD }}>WebRTC</span>
        </div>
        <button onClick={handleClose} style={{ color: GD }} aria-label="閉じる">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Center */}
      <div className="flex flex-col items-center gap-6 px-8">
        <div
          className="h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: isActive ? `radial-gradient(circle, ${G}30, ${G}10)` : `${G}08`,
            border:     `2px solid ${isActive ? G : `${G}30`}`,
            boxShadow:  isActive ? `0 0 40px ${G}40, 0 0 80px ${G}20` : 'none',
          }}
        >
          {status === 'idle' || status === 'error'
            ? <Mic   className="h-12 w-12" style={{ color: status === 'error' ? 'oklch(0.78 0.24 22)' : GD }} />
            : <Radio className="h-12 w-12" style={{ color: status === 'speaking' ? GB : '#4ade80' }} />
          }
        </div>

        <div className="text-center">
          <p className="text-xl font-bold tracking-[0.1em]" style={{ color: GB }}>{statusLabel}</p>
          {error && <p className="text-sm mt-2" style={{ color: 'oklch(0.78 0.24 22)' }}>{error}</p>}
          {!error && isActive && (
            <p className="text-xs mt-2" style={{ color: GD }}>話しかけてください。割込みも可能です。</p>
          )}
          {transcript && (
            <p className="text-sm mt-3 max-w-xs" style={{ color: 'oklch(0.70 0.008 75)' }}>{transcript}</p>
          )}
        </div>

        {status === 'idle' || status === 'error' ? (
          <button
            onClick={connect}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm transition-all active:scale-95"
            style={{ background: `linear-gradient(135deg, ${G}, ${GB})`, color: 'oklch(0.06 0.003 260)' }}
          >
            <Radio className="h-4 w-4" />
            Realtime 開始
          </button>
        ) : status === 'connecting' ? (
          <p className="text-xs" style={{ color: GD }}>WebRTC 接続中...</p>
        ) : (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all active:scale-95"
            style={{ background: `${G}14`, border: `1px solid ${G}40`, color: GD }}
          >
            <X className="h-3.5 w-3.5" />
            終了
          </button>
        )}
      </div>

      {/* Session info */}
      {isActive && (
        <div className="absolute bottom-8 text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase" style={{ color: GD }}>
            JARVIS に話すだけで業務操作できます
          </p>
        </div>
      )}
    </div>
  )
}
