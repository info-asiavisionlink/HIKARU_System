'use client'
// ============================================================
// SystemVoiceContext — System (Worker) Persistent Voice Provider
// WorkerLayoutに1つだけ配置。ページ遷移後もSessionを維持する。
// Realtime(WebRTC)を標準Voice Engine。失敗時はBrowser STTへfallback。
// useSystemJarvis() で各Pageから消費する。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS }            from '@/lib/voice/tts/browser'
import { resolveLocalIntent }    from '@/lib/voice/intent/resolver'
import { getScreenContext }      from '@/lib/voice/context/screen'
import type {
  VoiceMode, ConversationContext, LastResultData, VoiceSettings, PendingConfirmation,
} from '@/lib/voice/state/types'
import type { SystemActionName } from '@/lib/voice/registry/system.actions'

// ─── Realtime 定数 ────────────────────────────────────────────
const RT_MODEL = 'gpt-4o-realtime-preview'

const RT_SYSTEM_PROMPT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。
回答は2〜3文以内で音声向けに簡潔に。

## Write操作（最重要ルール）
打刻・作業開始・完了・経費申請等のWrite操作は必ずユーザーの確認を取ってから execute_confirmed_action を呼ぶ。
確認なしに実行ツールを呼ばない。

確認フロー:
1. 「出勤を打刻します。よろしいですか？」と聞く
2. ユーザーが「はい」等と答える
3. execute_confirmed_action({ action: 'system.clock_in', params: {} }) を呼ぶ
4. Tool結果が success なら時刻を発話。失敗なら「打刻できませんでした」と正確に伝える。

## actionとparamsの対応
- system.clock_in       出勤打刻（params: {}）
- system.clock_out      退勤打刻（params: {}）
- system.start_job      作業開始（params: { projectId }）
- system.complete_job   作業完了（params: { jobId } or { projectId }）
- system.submit_expense 経費申請（params: { expenseId }）
- system.mark_notification_read 通知既読（params: { notificationId }）`

// ─── Realtime Tools（ブラウザ側。credentials: 'include' でAuth）─
function buildHikaruRealtimeTools(
  router:      ReturnType<typeof useRouter>,
  projectIdRef: React.MutableRefObject<string | undefined>,
) {
  const apiFetch = async (path: string) => {
    const res = await fetch(path, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  }

  return [
    {
      name:        'get_today_jobs',
      description: '今日の担当作業・案件一覧とIDを取得する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await apiFetch('/api/home/data')
        if (!data) return '今日の作業情報を取得できませんでした。'
        const ps: Array<{ id: string; name: string }> = data.projects ?? []
        if (ps.length === 0) return '今日の担当作業はありません。'
        const list = ps.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} [id:${p.id}]`).join(', ')
        return `今日は${ps.length}件あります。${list}`
      },
    },
    {
      name:        'get_notifications',
      description: '通知・未読件数とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await apiFetch('/api/notifications')
        if (!data) return '通知を取得できませんでした。'
        const list = Array.isArray(data?.data) ? data.data : []
        const unread = list.filter((n: any) => !n.is_read)
        if (unread.length === 0) return '未読の通知はありません。'
        const items = unread.slice(0, 3).map((n: any, i: number) => `${i + 1}: ${n.title ?? '通知'} [id:${n.id}]`).join(', ')
        return `未読${unread.length}件。${items}`
      },
    },
    {
      name:        'get_attendance',
      description: '今日の勤怠・打刻状況を確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await apiFetch('/api/attendance')
        if (!data) return '勤怠情報を取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        const today = items[0] as any
        if (!today) return '本日の勤怠記録はありません。'
        const ci = today.clock_in  ? new Date(today.clock_in).toLocaleTimeString('ja-JP',  { hour: '2-digit', minute: '2-digit' }) : '未'
        const co = today.clock_out ? new Date(today.clock_out).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '未'
        return `本日: 出勤${ci} / 退勤${co}。`
      },
    },
    {
      name:        'get_expense_summary',
      description: '提出可能な経費申請（下書き）一覧とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await apiFetch('/api/expenses')
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
        const pid   = projectId || projectIdRef.current
        const today = new Date().toISOString().split('T')[0]
        const path  = pid ? `/api/jobs?projectId=${pid}&status=in_progress&date=${today}` : `/api/jobs?status=in_progress&date=${today}`
        const data  = await apiFetch(path)
        const jobs  = Array.isArray(data?.data) ? data.data : []
        const active = jobs.filter((j: any) => j.status === 'in_progress')
        if (active.length === 0) return '進行中の作業はありません。作業を開始してください。'
        return `進行中の作業 [jobId:${active[0].id}]。complete_jobのparamsにjobIdとして使用。`
      },
    },
    {
      name:        'get_schedule',
      description: '今後のスケジュールを確認する',
      parameters:  { type: 'object', properties: {}, required: [] },
      execute:     async () => {
        const data = await apiFetch('/api/schedule')
        if (!data) return 'スケジュールを取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        return items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`
      },
    },
    {
      name:        'navigate',
      description: '指定のページへ移動する',
      parameters:  {
        type:       'object',
        properties: {
          path:      { type: 'string', description: '/home, /jobs, /jobs/[jobId], /attendance, /expenses, /notifications, /schedule, /shifts, /profile 等' },
          projectId: { type: 'string', description: '案件ページへ移動する場合の案件ID' },
        },
        required: ['path'],
      },
      execute: async ({ path, projectId }: { path: string; projectId?: string }) => {
        const target = projectId ? path.replace('[jobId]', projectId).replace('[id]', projectId) : path
        router.push(target)
        return `${target}へ移動します。`
      },
    },
    {
      name:        'execute_confirmed_action',
      description: 'ユーザーが「はい」と明確に確認した後にのみ呼ぶ。Server Auth再検証して実行する。',
      parameters:  {
        type:       'object',
        properties: {
          action: {
            type: 'string',
            enum: ['system.clock_in', 'system.clock_out', 'system.start_job', 'system.complete_job', 'system.submit_expense', 'system.mark_notification_read'],
            description: '実行するAction名',
          },
          params: {
            type:                 'object',
            additionalProperties: { type: 'string' },
            description:          'jobId / projectId / expenseId / notificationId 等',
          },
        },
        required: ['action'],
      },
      execute: async ({ action, params = {} }: { action: string; params?: Record<string, string> }) => {
        try {
          const res = await fetch('/api/ai/confirm-action', {
            method:      'POST',
            headers:     { 'Content-Type': 'application/json' },
            credentials: 'include',
            body:        JSON.stringify({ action, params, safetyLevel: 3, expiresAt: Date.now() + 90_000 }),
          })
          const data = await res.json()
          return res.ok ? (data.voiceReply ?? '完了しました。') : (data.error ?? '実行に失敗しました。')
        } catch {
          return '実行中にエラーが発生しました。'
        }
      },
    },
  ]
}

// ─── STT型補完 ───────────────────────────────────────────────
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number
  start(): void; stop(): void; abort(): void
  onresult:  ((e: SpeechRecognitionEvent) => void) | null
  onerror:   ((e: SpeechRecognitionErrorEvent) => void) | null
  onend:     (() => void) | null
}

interface IntentResult {
  action:     SystemActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

export interface SystemVoiceChatMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// ─── セッション設定 ──────────────────────────────────────────
const SESSION_STOP_RE    = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
// 確認「はい」判定 — 完全一致セット + 特定パターン包含（誤検知リスクの単語を除外）
const CONFIRM_YES_EXACT  = new Set(['はい', 'うん', 'ええ', 'ok', 'OK', 'オーケー', 'そう', 'そうです', 'もちろん', 'わかりました', 'わかった'])
const CONFIRM_YES_STARTS = ['よろし', 'お願いします', 'いいです', 'いいよ', 'それでお願い', '実行して', '進めて', 'そうして', '承認します']
// 'いい'単独・'やって'・'してください'・'お願い'単独 は誤検知リスクが高いため除外

const CONFIRM_NO_EXACT   = new Set(['いいえ', 'いや', 'ノー'])
const CONFIRM_NO_STARTS  = ['やめ', 'キャンセル', 'やっぱり', '違います', '戻して', '実行しない', 'ストップ', '取り消し', '却下']

function isConfirmYes(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 20) return false
  if (CONFIRM_YES_EXACT.has(t)) return true
  return CONFIRM_YES_STARTS.some(w => t.startsWith(w) || t === w)
}
function isConfirmNo(text: string): boolean {
  const t = text.trim()
  if (!t || t.length > 25) return false
  if (CONFIRM_NO_EXACT.has(t)) return true
  return CONFIRM_NO_STARTS.some(w => t.startsWith(w) || t.includes(w))
}
const STANDBY_MS         = 60_000       // 60s 無発話 → Standby表示
const SESSION_TIMEOUT_MS = 5 * 60_000  // Standby後5分 → Session終了

// ─── Voice Settings localStorage ─────────────────────────────
const LS_KEY = 'hikaru_system_voice_settings'

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate:     1.0,
  pitch:    1.0,
  volume:   1.0,
}

function loadVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_VOICE_SETTINGS
    return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(raw) }
  } catch { return DEFAULT_VOICE_SETTINGS }
}

function saveVoiceSettings(s: VoiceSettings): void {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)) } catch {}
}

// ─── Voice Engine Mode ────────────────────────────────────────
// 'realtime'            = WebRTC Realtime（標準経路）
// 'realtime-connecting' = Realtime 接続試行中
// 'browser'             = Browser STT fallback
// 'off'                 = Session 未開始
export type VoiceEngineMode = 'realtime' | 'realtime-connecting' | 'browser' | 'off'

// ─── Context型 ───────────────────────────────────────────────
export interface SystemVoiceContextValue {
  mode:               VoiceMode
  isSession:          boolean
  isStandby:          boolean
  transcript:         string
  response:           string
  errorMessage:       string
  messages:           SystemVoiceChatMessage[]
  voiceSettings:      VoiceSettings
  setVoiceSettings:   (s: VoiceSettings) => void
  isSpeechSupported:  boolean
  voiceEngineMode:    VoiceEngineMode
  setVoiceEngineMode: (m: VoiceEngineMode) => void
  connectRealtime:    () => void
  disconnectRealtime: () => void
  startListening:     () => void
  stopAll:            () => void
  startSession:       () => void
  stopSession:        () => void
  handleUtterance:    (text: string) => Promise<void>
  currentProjectId:   string | undefined
}

const SystemVoiceContext = React.createContext<SystemVoiceContextValue | null>(null)

// ─── L1 データ取得 ───────────────────────────────────────────
interface L1Result { text: string; data: LastResultData }

async function fetchL1Result(action: SystemActionName, projectId?: string): Promise<L1Result> {
  const none = (text: string): L1Result => ({ text, data: { type: 'none' } })
  try {
    switch (action) {
      case 'system.get_today_jobs': {
        const res = await fetch('/api/home/data', { credentials: 'include' })
        if (!res.ok) return none('今日の作業情報を取得できませんでした。')
        const data = await res.json()
        const projects: Array<{ id: string; name: string }> = data.projects ?? []
        const total = data.summary?.total ?? projects.length
        if (total === 0) return none('今日の担当作業はまだありません。')
        const items = projects.slice(0, 5).map((p, i) => ({ id: p.id, label: `${i + 1}件目: ${p.name}` }))
        const first = projects[0]
        const text = total === 1
          ? `今日は${first.name}の1件です。開きますか？`
          : `今日は${total}件あります。最初は${first.name}です。開きますか？`
        return { text, data: { type: 'job_list', items } }
      }
      case 'system.get_notifications': {
        const res = await fetch('/api/notifications', { credentials: 'include' })
        if (!res.ok) return none('通知を取得できませんでした。')
        const data = await res.json()
        const list   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        const unread = list.filter((n: { is_read?: boolean }) => !n.is_read).length
        return none(unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。読み上げますか？`)
      }
      case 'system.get_schedule': {
        const res = await fetch('/api/schedule', { credentials: 'include' })
        if (!res.ok) return none('スケジュールを取得できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return none(items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`)
      }
      case 'system.get_shifts': {
        const res = await fetch('/api/shifts', { credentials: 'include' })
        if (!res.ok) return none('シフトを取得できませんでした。')
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return none(items.length === 0 ? 'シフトはありません。' : `シフトが${items.length}件登録されています。`)
      }
      case 'system.get_attendance':
        return none('勤怠画面に詳細を表示します。')
      case 'system.get_expenses': {
        const res = await fetch('/api/expenses', { credentials: 'include' })
        if (!res.ok) return none('経費情報を取得できませんでした。')
        const data = await res.json()
        const items   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        const pending = items.filter((e: { status?: string }) => e.status === 'draft' || e.status === 'submitted').length
        return none(pending === 0 ? '申請中の経費はありません。' : `申請中の経費が${pending}件あります。`)
      }
      case 'system.get_manuals': {
        if (!projectId) return none('マニュアルを確認するには案件の画面を開いてください。')
        const res = await fetch(`/api/jobs/${projectId}/manuals`, { credentials: 'include' })
        if (!res.ok) return none('マニュアルを取得できませんでした。')
        const data = await res.json()
        const list: Array<{ id: string; title: string }> = data.manuals ?? []
        if (list.length === 0) return none('マニュアルはまだ登録されていません。')
        const items = list.slice(0, 5).map((m, i) => ({ id: m.id, label: `${i + 1}件目: ${m.title}` }))
        const text = list.length === 1
          ? `${list[0].title}のマニュアルがあります。読み上げますか？`
          : `マニュアルが${list.length}件あります。どれを確認しますか？`
        return { text, data: { type: 'manual_list', items } }
      }
      case 'system.get_profile': {
        const res = await fetch('/api/profile', { credentials: 'include' })
        if (!res.ok) return none('プロフィールを取得できませんでした。')
        const data = await res.json()
        const name = data?.data?.name ?? data?.name
        return none(name ? `${name}さんのプロフィールです。` : 'プロフィール画面を確認してください。')
      }
      case 'system.get_job_detail': {
        if (!projectId) return none('案件の画面を開いてから確認してください。')
        const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include' })
        if (!res.ok) return none('案件情報を取得できませんでした。')
        const data = await res.json()
        const name = data?.data?.name ?? data?.name
        return none(name ? `現在の案件は${name}です。作業内容を確認しますか？` : '案件詳細を確認してください。')
      }
      default:
        return none('')
    }
  } catch {
    return none('データの取得中にエラーが発生しました。')
  }
}

// ─── L2 ナビゲーション ────────────────────────────────────────
function executeL2Navigation(
  action: SystemActionName,
  router:    ReturnType<typeof useRouter>,
  projectId?: string
): string {
  switch (action) {
    case 'system.go_home':            router.push('/home');                  return 'ホームに移動します'
    case 'system.go_back':            router.back();                         return '前の画面に戻ります'
    case 'system.open_notifications': router.push('/notifications');         return '通知画面を開きます'
    case 'system.open_schedule':      router.push('/schedule');              return 'スケジュールを開きます'
    case 'system.open_shifts':        router.push('/shifts');                return 'シフト管理画面を開きます'
    case 'system.open_attendance':    router.push('/attendance');            return '勤怠管理画面を開きます'
    case 'system.open_expenses':      router.push('/expenses');              return '経費申請画面を開きます'
    case 'system.open_profile':       router.push('/profile');               return 'プロフィール画面を開きます'
    case 'system.open_jobs_list':     router.push('/jobs');                  return '案件一覧を開きます'
    case 'system.open_job':
      if (!projectId) return '案件が特定できません。案件一覧から選んでください。'
      router.push(`/jobs/${projectId}`);                                     return '案件画面を開きます'
    case 'system.open_chat':
    case 'system.ask_manual':
      if (!projectId) return 'AI質問には案件の画面から入ってください。'
      router.push(`/jobs/${projectId}/chat`);                               return 'AIアシスタントを開きます'
    case 'system.open_manual':
      if (!projectId) return 'マニュアルを開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/manual`);                             return 'マニュアルを開きます'
    case 'system.open_before_camera':
      if (!projectId) return '案件の画面を開いてからBefore写真を撮影してください。'
      router.push(`/jobs/${projectId}/before`);                             return 'Before写真画面を開きます'
    case 'system.open_after_camera':
      if (!projectId) return '案件の画面を開いてからAfter写真を撮影してください。'
      router.push(`/jobs/${projectId}/after`);                              return 'After写真画面を開きます'
    case 'system.open_evaluation':
      if (!projectId) return 'AI評価には案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/evaluation`);                         return 'AI品質評価画面を開きます'
    case 'system.open_report':
      if (!projectId) return '報告書を開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/report`);                             return '報告書画面を開きます'
    default:
      return ''
  }
}

// ─── Provider ────────────────────────────────────────────────
export function SystemVoiceProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  // URL から現在のprojectIdを自動抽出
  const screenCtx        = React.useMemo(() => getScreenContext(pathname), [pathname])
  const currentProjectId = screenCtx.currentResourceId

  const [mode,            setMode]             = React.useState<VoiceMode>('idle')
  const [transcript,      setTranscript]       = React.useState('')
  const [response,        setResponse]         = React.useState('')
  const [errorMessage,    setErrorMessage]     = React.useState('')
  const [messages,        setMessages]         = React.useState<SystemVoiceChatMessage[]>([])
  const [isSession,       setIsSession]        = React.useState(false)
  const [isStandby,       setIsStandby]        = React.useState(false)
  const [voiceSettings,   setVoiceSettingsSt]  = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const [voiceEngineMode, setVoiceEngineMode]  = React.useState<VoiceEngineMode>('off')

  // ─── Realtime refs ────────────────────────────────────────────
  const realtimeSessionRef    = React.useRef<any>(null)
  const voiceEngineModeRef    = React.useRef<VoiceEngineMode>('off')

  React.useEffect(() => { voiceEngineModeRef.current = voiceEngineMode }, [voiceEngineMode])

  // localStorage から設定をロード（クライアントサイドのみ）
  React.useEffect(() => { setVoiceSettingsSt(loadVoiceSettings()) }, [])

  const setVoiceSettings = React.useCallback((s: VoiceSettings) => {
    setVoiceSettingsSt(s)
    saveVoiceSettings(s)
  }, [])

  const recognitionRef     = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef            = React.useRef<VoiceMode>('idle')
  const isSessionRef       = React.useRef(false)
  const standbyTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionTimerRef    = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef  = React.useRef<() => void>(() => {})
  const conversationCtxRef = React.useRef<ConversationContext>({})
  const messagesRef        = React.useRef<SystemVoiceChatMessage[]>([])
  const voiceSettingsRef   = React.useRef<VoiceSettings>(DEFAULT_VOICE_SETTINGS)
  const projectIdRef       = React.useRef<string | undefined>(undefined)
  const pathnameRef        = React.useRef(pathname)

  React.useEffect(() => { voiceSettingsRef.current = voiceSettings },  [voiceSettings])
  React.useEffect(() => { projectIdRef.current     = currentProjectId }, [currentProjectId])
  React.useEffect(() => { pathnameRef.current      = pathname },        [pathname])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  // ─── Standby / Session Timeout 管理 ─────────────────────────
  const clearActivityTimers = React.useCallback(() => {
    if (standbyTimerRef.current)  clearTimeout(standbyTimerRef.current)
    if (sessionTimerRef.current)  clearTimeout(sessionTimerRef.current)
  }, [])

  const scheduleStandby = React.useCallback(() => {
    clearActivityTimers()
    if (!isSessionRef.current) return
    setIsStandby(false)
    standbyTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      setIsStandby(true)
      // Standby後 SESSION_TIMEOUT_MS でSession終了
      sessionTimerRef.current = setTimeout(() => {
        if (!isSessionRef.current) return
        isSessionRef.current = false
        setIsSession(false)
        setIsStandby(false)
        browserTTS.stop()
        recognitionRef.current?.abort()
        modeRef.current = 'idle'
        setMode('idle')
      }, SESSION_TIMEOUT_MS)
    }, STANDBY_MS)
  }, [clearActivityTimers])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => {
      const next = [...prev.slice(-19), { role, text, timestamp: Date.now() }]
      messagesRef.current = next
      return next
    })
  }, [])

  const speakAndMaybeResume = React.useCallback((text: string) => {
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    }, voiceSettingsRef.current)
  }, [])

  const stopAll = React.useCallback(() => {
    clearActivityTimers()
    isSessionRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    // Realtime も切断
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const stopSession = React.useCallback(() => {
    clearActivityTimers()
    isSessionRef.current = false
    setIsSession(false)
    setIsStandby(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
    // Realtime も切断
    try { realtimeSessionRef.current?.close?.() }      catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [setModeSync])

  const executeAction = React.useCallback(async (result: IntentResult) => {
    const { action, confidence, voiceReply } = result

    if (!action || confidence < 0.6) {
      const msg = '発話の意図を理解できませんでした。もう一度お話しください。'
      setResponse(msg)
      addMessage('assistant', msg)
      speakAndMaybeResume(msg)
      return
    }

    const isNavAction = action === 'system.ask_manual'
      || action === 'system.open_chat'
      || action.startsWith('system.open_')
      || action === 'system.go_home'
      || action === 'system.go_back'

    if (isNavAction) {
      const effectiveProjectId = result.params?.projectId || projectIdRef.current
      const navReply = executeL2Navigation(action, router, effectiveProjectId)
      const reply    = voiceReply ?? navReply
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        lastIntent:    action,
        lastAction:    action,
        lastResultData: conversationCtxRef.current.lastResultData,
      }
      speakAndMaybeResume(reply)
      return
    }

    const l1    = await fetchL1Result(action, projectIdRef.current)
    const reply = voiceReply ?? l1.text
    setResponse(reply)
    addMessage('assistant', reply)
    conversationCtxRef.current = { lastIntent: action, lastAction: action, lastResultData: l1.data }
    speakAndMaybeResume(reply)
  }, [router, addMessage, speakAndMaybeResume])

  // ─── Confirmed Action 実行 ───────────────────────────────────
  const executeConfirmedAction = React.useCallback(async (pending: PendingConfirmation) => {
    setModeSync('processing')
    try {
      const res = await fetch('/api/ai/confirm-action', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({
          action:      pending.action,
          params:      pending.params,
          safetyLevel: pending.safetyLevel,
          expiresAt:   pending.expiresAt,
        }),
      })
      const data = await res.json()
      const reply = res.ok
        ? (data.voiceReply ?? '完了しました。')
        : (data.error     ?? '実行に失敗しました。')
      setResponse(reply)
      addMessage('assistant', reply)
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        lastIntent:          pending.action,
        lastAction:          pending.action,
        pendingConfirmation: undefined,
      }
      speakAndMaybeResume(reply)
    } catch {
      finishWithError('実行中にエラーが発生しました。')
    }
  }, [addMessage, speakAndMaybeResume, finishWithError, setModeSync])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    // ─── 期限切れ pendingConfirmation の自動クリア ───────────────
    const expiredPending = conversationCtxRef.current.pendingConfirmation
    if (expiredPending && Date.now() > expiredPending.expiresAt) {
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
      if (isConfirmYes(utterance.trim()) || isConfirmNo(utterance.trim())) {
        const msg = '確認の有効期限が切れました。もう一度操作してください。'
        setResponse(msg); addMessage('user', utterance); addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      // 別の発話ならそのまま処理継続
    }

    // セッション停止ワード
    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearActivityTimers()
      setIsStandby(false)
      speakAndMaybeResume('会話を終了します')
      return
    }

    // ─── Confirmation 待ち中の「はい/いいえ」処理 ─────────────
    const pending = conversationCtxRef.current.pendingConfirmation
    if (pending) {
      scheduleStandby()
      setIsStandby(false)
      setTranscript(utterance)
      addMessage('user', utterance)
      if (isConfirmYes(utterance.trim())) {
        await executeConfirmedAction(pending)
        return
      }
      if (isConfirmNo(utterance.trim())) {
        conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
        const msg = 'キャンセルしました。'
        setResponse(msg)
        addMessage('assistant', msg)
        speakAndMaybeResume(msg)
        return
      }
      // 別の発話 → pendingをクリアして通常処理
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: undefined }
    }

    scheduleStandby()
    setIsStandby(false)
    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const localResult = resolveLocalIntent(utterance)
    if (localResult?.action && localResult.confidence >= 0.6) {
      await executeAction(localResult)
      return
    }

    // ─── ローカル書き込み提案（AI不要・即時応答）───────────────────
    // 出勤/退勤打刻は毎日使う最頻出操作なのでAI経由を省略
    const text = utterance.trim()
    const hasClockIn  = /出勤|チェックイン|始業|きました|来ました/.test(text) || (text.includes('打刻') && !text.includes('退勤') && !text.includes('帰'))
    const hasClockOut = /退勤|チェックアウト|終業|帰り|帰ります|上がり/.test(text)
    if (hasClockIn && !hasClockOut) {
      const confirm: PendingConfirmation = {
        action: 'system.clock_in', params: {}, safetyLevel: 3,
        message: '出勤を打刻します。よろしいですか？',
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: confirm }
      const reply = '出勤を打刻します。よろしいですか？'
      setResponse(reply); addMessage('assistant', reply); speakAndMaybeResume(reply)
      return
    }
    if (hasClockOut) {
      const confirm: PendingConfirmation = {
        action: 'system.clock_out', params: {}, safetyLevel: 3,
        message: '退勤を打刻します。よろしいですか？',
        expiresAt: Date.now() + 5 * 60 * 1000,
      }
      conversationCtxRef.current = { ...conversationCtxRef.current, pendingConfirmation: confirm }
      const reply = '退勤を打刻します。よろしいですか？'
      setResponse(reply); addMessage('assistant', reply); speakAndMaybeResume(reply)
      return
    }

    try {
      const ctx = getScreenContext(pathnameRef.current)
      const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))

      const requestBody = {
        utterance,
        currentPath:         pathnameRef.current,
        currentResourceId:   projectIdRef.current ?? ctx.currentResourceId,
        contextType:         ctx.contextType,
        recentMessages,
        lastIntent:          conversationCtxRef.current.lastIntent,
        lastResultData:      conversationCtxRef.current.lastResultData,
        previousResponseId:  conversationCtxRef.current.previousResponseId,
      }

      // SDK経路（Agents SDK + Responses API）を優先
      // 失敗時は既存 /api/ai/agent へfallback
      let result: Record<string, unknown> | null = null
      let usedSdkRoute = false

      try {
        const sdkRes = await fetch('/api/ai/agent-sdk', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (sdkRes.ok) {
          result = await sdkRes.json()
          usedSdkRoute = true
        }
      } catch {}

      if (!result || (result as any).error) {
        // SDK失敗 → 既存Agentへfallback
        const fallbackRes = await fetch('/api/ai/agent', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify(requestBody),
        })
        if (!fallbackRes.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
        result = await fallbackRes.json()
        usedSdkRoute = false
      }

      if (!result) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }

      // Conversation Contextを更新
      conversationCtxRef.current = {
        ...conversationCtxRef.current,
        ...(result.resultData ? { lastResultData: result.resultData as any } : {}),
        ...(usedSdkRoute && result.previousResponseId
          ? { previousResponseId: result.previousResponseId as string }
          : {}),
        ...(result.pendingConfirmation
          ? { pendingConfirmation: result.pendingConfirmation as PendingConfirmation }
          : {}),
      }

      // Stateless Confirmation: AgentがL3/L4操作を提案している
      if (result.pendingConfirmation && result.voiceReply) {
        const confirmMsg = result.voiceReply as string
        setResponse(confirmMsg)
        addMessage('assistant', confirmMsg)
        speakAndMaybeResume(confirmMsg)
        return
      }

      // action=null + voiceReply → Agentが直接回答
      if (!result.action && result.voiceReply) {
        setResponse(result.voiceReply as string)
        addMessage('assistant', result.voiceReply as string)
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastIntent: 'agent.response',
          lastAction: undefined,
        }
        speakAndMaybeResume(result.voiceReply as string)
        return
      }

      // action あり → 既存 executeAction（Nav 実行）
      await executeAction(result as any)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [executeAction, finishWithError, addMessage, speakAndMaybeResume, clearActivityTimers, scheduleStandby, setModeSync])

  // ─── Realtime 接続（Provider レベルで1つだけ持続）───────────────
  const connectRealtime = React.useCallback(async () => {
    if (realtimeSessionRef.current) return
    if (voiceEngineModeRef.current === 'realtime-connecting') return

    setVoiceEngineMode('realtime-connecting')
    voiceEngineModeRef.current = 'realtime-connecting'

    try {
      const tokenRes = await fetch('/api/ai/realtime-token', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ model: RT_MODEL }),
      })
      if (!tokenRes.ok) throw new Error('token_failed')
      const { clientSecret } = await tokenRes.json()
      if (!clientSecret) throw new Error('no_token')

      const { RealtimeAgent, RealtimeSession } = await import('@openai/agents/realtime') as any
      const tools   = buildHikaruRealtimeTools(router, projectIdRef)
      const agent   = new RealtimeAgent({ name: 'JARVIS Worker Realtime', instructions: RT_SYSTEM_PROMPT, model: RT_MODEL, tools })
      const session = new RealtimeSession(agent, { model: RT_MODEL })

      session.on?.('connected', () => {
        setVoiceEngineMode('realtime')
        voiceEngineModeRef.current = 'realtime'
        setModeSync('listening')
      })
      session.on?.('disconnected', () => {
        realtimeSessionRef.current = null
        if (isSessionRef.current) {
          setVoiceEngineMode('browser')
          voiceEngineModeRef.current = 'browser'
          addMessage('assistant', '接続を切り替えました。そのまま話してください。')
          setTimeout(() => { if (isSessionRef.current && voiceEngineModeRef.current === 'browser') startListeningRef.current() }, 800)
        } else {
          setVoiceEngineMode('off')
          voiceEngineModeRef.current = 'off'
          setModeSync('idle')
        }
      })
      session.on?.('error', () => {
        realtimeSessionRef.current = null
        setVoiceEngineMode('browser')
        voiceEngineModeRef.current = 'browser'
        if (isSessionRef.current) startListeningRef.current()
      })
      session.on?.('agent_start_speech',  () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('speaking') })
      session.on?.('agent_end_speech',    () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('listening') })
      session.on?.('user_start_speech',   () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('listening') })
      session.on?.('user_end_speech',     () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('processing') })
      // Tool実行中は 'working' へ
      session.on?.('tool_call_start',     () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('working') })
      session.on?.('tool_call_end',       () => { if (voiceEngineModeRef.current === 'realtime') setModeSync('processing') })

      // 発話テキスト → messages に反映
      session.on?.('user_transcription_done',  (text: string) => {
        if (text?.trim()) { setTranscript(text.trim()); addMessage('user', text.trim()) }
      })
      session.on?.('agent_transcription_done', (text: string) => {
        if (text?.trim()) { setResponse(text.trim()); addMessage('assistant', text.trim()) }
      })

      await session.connect({ apiKey: clientSecret })
      realtimeSessionRef.current = session

    } catch (err) {
      console.error('[realtime-connect]', err)
      setVoiceEngineMode('browser')
      voiceEngineModeRef.current = 'browser'
      if (isSessionRef.current) setTimeout(() => startListeningRef.current(), 400)
    }
  }, [router, addMessage, setModeSync])

  const disconnectRealtime = React.useCallback(() => {
    try { realtimeSessionRef.current?.close?.() } catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [])

  const startListening = React.useCallback(() => {
    // Realtime が接続中または接続試行中ならスキップ（Realtime が Audio を管理）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          finishWithError('音声が検出されませんでした。')
        }
      } else if (e.error === 'aborted') {
        // ページ遷移等で中断 → セッション中は黙って再試行
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 500)
        } else {
          setModeSync('idle')
        }
      } else {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
        } else {
          finishWithError('音声認識でエラーが発生しました。')
        }
      }
    }
    rec.onend = () => {
      if (modeRef.current === 'listening') {
        if (isSessionRef.current) {
          setModeSync('idle')
          setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 300)
        } else {
          setModeSync('idle')
        }
      }
    }
    try { rec.start() } catch { finishWithError('マイクを起動できませんでした。') }
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync])

  React.useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const startSession = React.useCallback(() => {
    isSessionRef.current = true
    setIsSession(true)
    setIsStandby(false)
    scheduleStandby()
    // Realtime（WebRTC）を優先接続。失敗時はBrowser STTへ自動fallback。
    connectRealtime()
  }, [scheduleStandby, connectRealtime])

  // ─── Phase P2: ページ遷移後の自然な次Action提案 ──────────────
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (!isSessionRef.current) return
    if (prev === pathname) return

    const ctx = getScreenContext(pathname)
    const lastAction = conversationCtxRef.current.lastAction ?? ''

    // Job ページへ遷移した場合
    if (ctx.contextType === 'job' && ctx.currentResourceId) {
      const items = conversationCtxRef.current.lastResultData?.items ?? []
      const found = items.find(i => i.id === ctx.currentResourceId)
      const name  = found ? found.label.replace(/^\d+件目:\s*/, '') : null
      const msg   = name
        ? `${name}を開きました。作業内容を確認しますか？`
        : '案件を開きました。作業内容を確認しますか？'
      setTimeout(() => {
        if (!isSessionRef.current) return
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // マニュアルページへ遷移
    if (ctx.contextType === 'manual' && lastAction === 'system.open_manual') {
      setTimeout(() => {
        if (!isSessionRef.current) return
        const msg = 'マニュアルを開きました。読み上げますか？'
        addMessage('assistant', msg)
        setResponse(msg)
        speakAndMaybeResume(msg)
      }, 900)
      return
    }

    // 通知ページへ遷移
    if (ctx.contextType === 'notifications' && lastAction === 'system.open_notifications') {
      return // 通知へのNavigation replyで十分（過剰にしない）
    }
  }, [pathname, addMessage, speakAndMaybeResume])

  // ─── ページ遷移後の音声認識フェイルセーフ復旧 ──────────────────
  // ブラウザがSpeechRecognitionをページ遷移時に中断した場合でも
  // セッションが生きていればlistening状態を確実に回復する
  React.useEffect(() => {
    if (!isSessionRef.current) return
    const timer = setTimeout(() => {
      if (isSessionRef.current && modeRef.current === 'idle') {
        startListeningRef.current()
      }
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ─── Logout時のクリーンアップ ─────────────────────────────────
  React.useEffect(() => {
    const handleLogout = () => {
      stopAll()
      setMessages([])
      messagesRef.current = []
      conversationCtxRef.current = {}
    }
    window.addEventListener('hikaru:logout', handleLogout)
    return () => window.removeEventListener('hikaru:logout', handleLogout)
  }, [stopAll])

  const value = React.useMemo<SystemVoiceContextValue>(() => ({
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, setVoiceEngineMode,
    connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    currentProjectId,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, setVoiceEngineMode,
    connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    currentProjectId,
  ])

  return (
    <SystemVoiceContext.Provider value={value}>
      {children}
    </SystemVoiceContext.Provider>
  )
}

// ─── Consumer hook ────────────────────────────────────────────
export function useSystemJarvis(): SystemVoiceContextValue {
  const ctx = React.useContext(SystemVoiceContext)
  if (!ctx) throw new Error('useSystemJarvis must be used within SystemVoiceProvider')
  return ctx
}
