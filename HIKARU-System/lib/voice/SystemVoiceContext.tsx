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
// gpt-realtime-2.1 = @openai/agents-realtime v0.17 のデフォルトモデル。
// SDKのデフォルトconfig（semantic_vad / audio/pcm / gpt-4o-mini-transcribe）と整合する。
const RT_MODEL = 'gpt-realtime-2.1'

const RT_SYSTEM_PROMPT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で業務をサポートします。
回答は2〜3文以内で音声向けに簡潔に。

## Navigation操作（Read-only・安全）
「〇〇を開いて」「〇〇に移動して」「〇〇見せて」等のリクエストは navigate_to ツールを使う。
destinationは必ず下記のEnum値を選ぶ（自由なURLは絶対禁止）。
移動後は「〇〇を開きました」と簡潔に発話する。

destination値:
home=ホーム, attendance=勤怠管理, schedule=スケジュール,
shifts=シフト管理, expenses=経費申請, notifications=通知,
profile=プロフィール, jobs=案件一覧, assistant=アシスタント,
back=前の画面, job_detail=案件詳細, job_chat=AIチャット,
job_manual=マニュアル, job_report=報告書

## Write操作（最重要ルール）
打刻・作業開始・完了・経費申請等のWrite操作は必ずユーザーの確認を取ってから execute_confirmed_action を呼ぶ。
確認なしに実行ツールを呼ばない。
Tool Resultが返ってきてから初めて「完了しました」と発話する。
Tool Resultを待たずに「やりました」「完了しました」と言うことは絶対禁止。

確認フロー（必ず守る）:
1. 「出勤を打刻します。よろしいですか？」と聞く
2. ユーザーが「はい」等と答える
3. execute_confirmed_action({ action: 'system.clock_in', params: {} }) を呼ぶ
4. Tool Resultが返ってくる
5. success=trueならToolが返したvoiceReplyをそのまま発話
6. 失敗なら「打刻できませんでした」と正確に伝える

## actionとparamsの対応
- system.clock_in       出勤打刻（params: {}）
- system.clock_out      退勤打刻（params: {}）
- system.start_job      作業開始（params: { projectId }）※projectIdはget_current_contextかget_today_jobsで取得
- system.complete_job   作業完了（params: { projectId }）※projectIdは同上
- system.submit_expense 経費申請（params: { expenseId }）※expenseIdはget_expense_summaryで取得
- system.mark_notification_read 通知既読（params: { notificationId }）※notificationIdはget_notificationsで取得

## Context解決ルール（ID取得の順序）
ユーザーが「この作業」「今の案件」等と言った場合:
1. まず get_current_context を呼んでcurrentProjectIdを確認
2. projectIdがあれば確認文句でユーザーに確認する
3. projectIdがなければ get_today_jobs で一覧取得してユーザーに選ばせる
projectIdを推測・捏造しない。必ずツールで取得した実IDを使う。`

// ─── Realtime Tools（ブラウザ側。credentials: 'include' でAuth）─
// toolFactory = SDK の tool() 関数。FunctionTool を生成し invoke を持つオブジェクトを返す。
// plain object { execute } では SDK が invoke を呼べないため Tool 実行が無音で失敗する。
function buildHikaruRealtimeTools(
  router:       ReturnType<typeof useRouter>,
  projectIdRef: React.MutableRefObject<string | undefined>,
  toolFactory:  (opts: any) => any,
  pathnameRef:  React.MutableRefObject<string>,
) {
  const apiFetch = async (path: string) => {
    const res = await fetch(path, { credentials: 'include' })
    if (!res.ok) return null
    return res.json()
  }

  return [
    toolFactory({
      // 現在の画面コンテキストを返す — start_job/complete_jobのprojectId解決に使用
      name:        'get_current_context',
      description: '現在開いている画面のURL・案件IDを取得する。作業開始・完了前にprojectIdを確認するために使う。',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const path      = pathnameRef.current
        const projectId = projectIdRef.current
        const isJobPage = path?.startsWith('/jobs/') && projectId
        if (isJobPage) {
          return `現在 /jobs/${projectId} を表示中。currentProjectId=${projectId}。start_jobまたはcomplete_jobのparamsに{ projectId: "${projectId}" }を使用。`
        }
        return `現在 ${path || '/home'} を表示中。案件ページではありません。案件操作にはget_today_jobsで一覧を取得してください。`
      },
    }),
    toolFactory({
      name:        'get_today_jobs',
      description: '今日の担当作業・案件一覧とIDを取得する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/home/data')
        if (!data) return '今日の作業情報を取得できませんでした。'
        const ps: Array<{ id: string; name: string }> = data.projects ?? []
        if (ps.length === 0) return '今日の担当作業はありません。'
        const list = ps.slice(0, 5).map((p, i) => `${i + 1}件目: ${p.name} [id:${p.id}]`).join(', ')
        return `今日は${ps.length}件あります。${list}`
      },
    }),
    toolFactory({
      name:        'get_notifications',
      description: '通知・未読件数とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/notifications')
        if (!data) return '通知を取得できませんでした。'
        const list = Array.isArray(data?.data) ? data.data : []
        const unread = list.filter((n: any) => !n.is_read)
        if (unread.length === 0) return '未読の通知はありません。'
        const items = unread.slice(0, 3).map((n: any, i: number) => `${i + 1}: ${n.title ?? '通知'} [id:${n.id}]`).join(', ')
        return `未読${unread.length}件。${items}`
      },
    }),
    toolFactory({
      name:        'get_attendance',
      description: '今日の勤怠・打刻状況を確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
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
    }),
    toolFactory({
      name:        'get_expense_summary',
      description: '提出可能な経費申請（下書き）一覧とIDを確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/expenses')
        if (!data) return '経費情報を取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        const drafts = items.filter((e: any) => e.status === 'draft')
        if (drafts.length === 0) return '提出可能な経費申請はありません。'
        const list = drafts.slice(0, 3).map((e: any, i: number) => `${i + 1}: ${e.title ?? `¥${e.amount}`} [id:${e.id}]`).join(', ')
        return `提出可能な経費申請${drafts.length}件。${list}`
      },
    }),
    toolFactory({
      name:        'get_active_job',
      description: '今日の進行中作業のjobIdを取得する（complete_jobで必要）',
      parameters:  {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: [],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { projectId } = input ?? {}
        const pid   = projectId || projectIdRef.current
        const today = new Date().toISOString().split('T')[0]
        const path  = pid ? `/api/jobs?projectId=${pid}&status=in_progress&date=${today}` : `/api/jobs?status=in_progress&date=${today}`
        const data  = await apiFetch(path)
        const jobs  = Array.isArray(data?.data) ? data.data : []
        const active = jobs.filter((j: any) => j.status === 'in_progress')
        if (active.length === 0) return '進行中の作業はありません。作業を開始してください。'
        return `進行中の作業 [jobId:${active[0].id}]。complete_jobのparamsにjobIdとして使用。`
      },
    }),
    toolFactory({
      name:        'get_schedule',
      description: '今後のスケジュールを確認する',
      parameters:  { type: 'object', properties: {}, required: [], additionalProperties: false },
      execute:     async () => {
        const data = await apiFetch('/api/schedule')
        if (!data) return 'スケジュールを取得できませんでした。'
        const items = Array.isArray(data?.data) ? data.data : []
        return items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`
      },
    }),
    toolFactory({
      // navigate_to — Allowlist Registry経由。自由URL禁止。tool()で正式なFunctionToolを生成。
      name:        'navigate_to',
      description: 'ページへ移動する。destinationは必ずEnum値から選ぶ。自由URLは絶対禁止。',
      parameters:  {
        type:       'object',
        properties: {
          destination: {
            type: 'string',
            enum: ['home', 'attendance', 'schedule', 'shifts', 'expenses', 'notifications', 'profile', 'jobs', 'assistant', 'back', 'job_detail', 'job_chat', 'job_manual', 'job_report'],
          },
          jobId: { type: 'string' },
        },
        required:             ['destination'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { destination, jobId } = input ?? {}
        const NAV: Record<string, string> = {
          home: '/home', attendance: '/attendance', schedule: '/schedule',
          shifts: '/shifts', expenses: '/expenses', notifications: '/notifications',
          profile: '/profile', jobs: '/jobs', assistant: '/assistant',
        }
        const LABELS: Record<string, string> = {
          home: 'ホーム', attendance: '勤怠管理', schedule: 'スケジュール',
          shifts: 'シフト管理', expenses: '経費申請', notifications: '通知',
          profile: 'プロフィール', jobs: '案件一覧', assistant: 'アシスタント',
        }
        console.log('[JARVIS-nav] tool_called navigate_to', Date.now())
        console.log('[JARVIS-nav] destination', destination)
        if (destination === 'back') {
          router.back()
          console.log('[JARVIS-nav] router_back_called')
          return '前の画面に戻りました。'
        }
        const subPages: Record<string, string> = {
          job_detail: '', job_chat: '/chat', job_manual: '/manual', job_report: '/report',
        }
        if (destination in subPages) {
          const id = jobId || projectIdRef.current
          if (!id) return '案件を特定できません。案件一覧から選んでください。'
          const route = `/jobs/${id}${subPages[destination]}`
          console.log('[JARVIS-nav] target_route', route)
          router.push(route)
          console.log('[JARVIS-nav] router_push_called')
          const label = destination === 'job_detail' ? '案件詳細'
            : destination === 'job_chat' ? 'AIアシスタント'
            : destination === 'job_manual' ? 'マニュアル' : '報告書'
          return `${label}を開きました。`
        }
        const route = NAV[destination]
        if (!route) {
          console.log('[JARVIS-nav] unknown_destination', destination)
          return 'その画面は現在操作対象にありません。'
        }
        console.log('[JARVIS-nav] target_route', route)
        router.push(route)
        console.log('[JARVIS-nav] router_push_called')
        return `${LABELS[destination] ?? route}を開きました。`
      },
    }),
    toolFactory({
      name:        'execute_confirmed_action',
      description: 'ユーザーが「はい」と明確に確認した後にのみ呼ぶ。Server Auth再検証して実行する。',
      parameters:  {
        type:       'object',
        properties: {
          action: {
            type: 'string',
            enum: ['system.clock_in', 'system.clock_out', 'system.start_job', 'system.complete_job', 'system.submit_expense', 'system.mark_notification_read'],
          },
          params: {
            type:                 'object',
            additionalProperties: { type: 'string' },
          },
        },
        required:             ['action'],
        additionalProperties: false,
      },
      execute: async (input: any) => {
        const { action, params = {} } = input ?? {}
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
    }),
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
const STANDBY_MS = 60_000  // 60s 無発話 → Standby表示（Sessionは「終了」発声まで継続）

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
  interrupt:          () => void
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
  const micTrackRef      = React.useRef<MediaStreamTrack | null>(null)
  const isSpeakingRef    = React.useRef(false)
  const resumeTimerRef   = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamingTranscriptRef = React.useRef('')

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
  const connectRealtimeRef = React.useRef<() => void>(() => {})
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

  // ─── Mic / Resume Timer ───────────────────────────────────────
  const clearResumeTimer = React.useCallback(() => {
    if (resumeTimerRef.current) { clearTimeout(resumeTimerRef.current); resumeTimerRef.current = null }
  }, [])

  const findMicTrack = React.useCallback(() => {
    if (micTrackRef.current) return
    try {
      const transport = (realtimeSessionRef.current as any)?.transport
      if (!transport) return
      const pc: RTCPeerConnection | undefined =
        transport.peerConnection ?? transport._peerConnection ?? transport.pc
      if (!pc) return
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind === 'audio') { micTrackRef.current = sender.track; break }
      }
    } catch {}
  }, [])

  // Tool実行中のMute — SDKのmute()のみ使用。WebRTC track直接操作は行わない。
  // semantic_vad+WebRTC環境ではSDKをPrimaryにし、track.enabled競合を排除する。
  const muteMic = React.useCallback((mute: boolean) => {
    try { (realtimeSessionRef.current as any)?.mute?.(mute) } catch {}
  }, [])

  const interrupt = React.useCallback(() => {
    clearResumeTimer()
    try { (realtimeSessionRef.current as any)?.interrupt?.() } catch {}
    isSpeakingRef.current = false
    muteMic(false)
    setModeSync('listening')
  }, [clearResumeTimer, muteMic, setModeSync])

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
      // Standby表示のみ。Sessionはユーザーが「終了」と言うまで継続。
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
    clearResumeTimer()
    isSessionRef.current = false
    isSpeakingRef.current = false
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
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, clearResumeTimer, setModeSync])

  const stopSession = React.useCallback(() => {
    clearActivityTimers()
    clearResumeTimer()
    isSessionRef.current = false
    isSpeakingRef.current = false
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
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearActivityTimers, clearResumeTimer, setModeSync])

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
      if (!tokenRes.ok) {
        const errBody = await tokenRes.text().catch(() => '')
        throw new Error(`token_failed:${tokenRes.status} ${errBody}`)
      }
      const tokenData = await tokenRes.json()
      const clientSecret: string | null = tokenData.clientSecret ?? null
      if (!clientSecret) throw new Error('no_token: clientSecret missing in response')

      // tool() ファクトリを取得 — plain objectではなくFunctionTool(invoke付き)を生成するために必須
      const { RealtimeAgent, RealtimeSession, tool: toolFactory } = await import('@openai/agents/realtime') as any
      const tools   = buildHikaruRealtimeTools(router, projectIdRef, toolFactory, pathnameRef)
      const agent   = new RealtimeAgent({ name: 'JARVIS Worker Realtime', instructions: RT_SYSTEM_PROMPT, tools })
      // transport: 'webrtc' は ephemeral client secret (ek_...) での接続に必須
      // eagerness: 'high' でsemantic_VADのターン検出を高速化（Latency改善）
      const session = new RealtimeSession(agent, {
        transport: 'webrtc',
        model:     RT_MODEL,
        config:    {
          audio: {
            input: {
              turnDetection: { type: 'semantic_vad', eagerness: 'high' },
            },
          },
        },
      } as any)

      // ── @openai/agents-realtime v0.17 正式イベント ──────────────
      // 注: connected/disconnected/agent_start_speech/agent_end_speech/
      //     user_start_speech/user_end_speech/tool_call_start/tool_call_end/
      //     user_transcription_done/agent_transcription_done は v0.17に存在しない。

      // AI処理開始（通常audio_start前に発火するが、高速応答時は逆転することがある）
      // listening/idle時のみprocessingへ遷移。speaking中は上書きしない。
      // Streamingトランスクリプトをリセット（新しいAI回答の準備）
      session.on?.('agent_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        streamingTranscriptRef.current = ''
        setResponse('')
        if (modeRef.current === 'listening' || modeRef.current === 'idle') {
          setModeSync('processing')
        }
        console.log('[JARVIS-latency] agent_start', Date.now())
      })

      // AI音声出力開始
      session.on?.('audio_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = true
        clearResumeTimer()
        setModeSync('speaking')
        console.log('[JARVIS-latency] audio_start (first AI audio)', Date.now())
      })

      // AI音声出力終了 → 300ms後にListeningへ
      session.on?.('audio_stopped', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        setModeSync('processing')
        clearResumeTimer()
        console.log('[JARVIS-latency] audio_stopped', Date.now())
        resumeTimerRef.current = setTimeout(() => {
          if (voiceEngineModeRef.current !== 'realtime') return
          if (modeRef.current !== 'processing') return
          setModeSync('listening')
          console.log('[JARVIS-latency] listening_restored', Date.now())
        }, 300)
      })

      // AI回答完了 — 3番目の引数にtext output（v0.17型定義確認済み）
      // Dedupe: 同一turnで同一テキストが二重に追加されないようMessagesRefと照合
      session.on?.('agent_end', (_ctx: unknown, _agent: unknown, output: string) => {
        const text = (output ?? '').trim()
        if (!text) return
        const msgs = messagesRef.current
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant' && last.text === text) return
        setResponse(text)
        addMessage('assistant', text)
      })

      // Tool開始
      session.on?.('agent_tool_start', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(true)
        setModeSync('working')
      })

      // Tool終了 — Mic解除してprocessingへ
      session.on?.('agent_tool_end', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        muteMic(false)
        setModeSync('processing')
      })

      // User Transcript (input_textのみ) — audio transcriptはtransport_eventで取得
      // input_audioはhistory_added時点でtranscript=nullのため、ここでは扱わない
      session.on?.('history_added', (item: any) => {
        if (item?.type !== 'message' || item?.role !== 'user') return
        const content: any[] = Array.isArray(item.content) ? item.content : []
        const textInput = content.find((c: any) => c.type === 'input_text')
        if (textInput?.text) {
          setTranscript(textInput.text)
          addMessage('user', textInput.text)
        }
      })

      // Barge-in（User割り込み）— SDKが音声停止済み、stateをlisteningへ
      session.on?.('audio_interrupted', () => {
        if (voiceEngineModeRef.current !== 'realtime') return
        isSpeakingRef.current = false
        clearResumeTimer()
        streamingTranscriptRef.current = ''
        setModeSync('listening')
        console.log('[JARVIS-latency] audio_interrupted (barge-in)', Date.now())
      })

      // Error — ログのみ。Non-fatalエラーでSessionを終了しない（Infinite Conversation維持）
      // 実際の切断はtransport connection_changeイベントで検知・処理する。
      session.on?.('error', (err: unknown) => {
        const msg = (err as any)?.error?.message ?? (err as Error)?.message ?? String(err)
        console.error('[realtime] session error (non-fatal, session continues):', msg)
      })

      // ── Transport level listeners (v0.17 確認済みAPI) ───────────
      const transport = session.transport as any

      // User音声Transcript確定 — history_addedのinput_audioはtranscript=nullのためここで処理
      // SDKがInputAudioTranscriptionCompletedEventをtransport_eventとして発火する
      session.on?.('transport_event', (event: any) => {
        if (event?.type !== 'conversation.item.input_audio_transcription.completed') return
        const text = (event.transcript ?? '').trim()
        if (!text || voiceEngineModeRef.current !== 'realtime') return
        setTranscript(text)
        addMessage('user', text)
        console.log('[JARVIS-latency] user_transcript_completed', Date.now(), text.slice(0, 20))
      })

      // AI Transcript Streaming Delta — 音声再生と同期してUIテキストを逐次更新
      // Single Source of Truth: deltaを累積し、agent_endで最終確定テキストで上書き
      transport.on?.('audio_transcript_delta', (deltaEvent: any) => {
        if (voiceEngineModeRef.current !== 'realtime') return
        const delta = deltaEvent?.delta ?? ''
        if (!delta) return
        streamingTranscriptRef.current += delta
        setResponse(streamingTranscriptRef.current)
      })

      // 接続状態変化 — 予期せぬ切断時にSession継続のため自動Reconnect（1回）
      transport.on?.('connection_change', (status: any) => {
        if (status !== 'disconnected') return
        if (!isSessionRef.current) return
        if (voiceEngineModeRef.current !== 'realtime') return
        console.warn('[realtime] connection dropped, reconnecting in 1.5s')
        realtimeSessionRef.current = null
        clearResumeTimer()
        isSpeakingRef.current = false
        setVoiceEngineMode('off')
        voiceEngineModeRef.current = 'off'
        setModeSync('processing')
        setTimeout(() => {
          if (!isSessionRef.current) return
          if (voiceEngineModeRef.current !== 'off') return
          connectRealtimeRef.current()
        }, 1500)
      })

      await session.connect({ apiKey: clientSecret } as any)

      // connect()が正常解決 = WebRTC接続確立。イベント待ちせず即座にrealtime状態をセット。
      realtimeSessionRef.current = session
      setVoiceEngineMode('realtime')
      voiceEngineModeRef.current = 'realtime'
      setModeSync('listening')

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[realtime-connect] failed:', msg)
      // SpeechRecognition自動起動を削除。Mic競合・点滅の根本原因。
      // 接続失敗時はidleに戻す。ユーザーが手動でJARVISを再起動できる。
      realtimeSessionRef.current = null
      micTrackRef.current = null
      setVoiceEngineMode('off')
      voiceEngineModeRef.current = 'off'
      setModeSync('idle')
    }
  }, [router, addMessage, setModeSync, muteMic, clearResumeTimer, setResponse])

  React.useEffect(() => { connectRealtimeRef.current = connectRealtime }, [connectRealtime])

  const disconnectRealtime = React.useCallback(() => {
    clearResumeTimer()
    try { realtimeSessionRef.current?.close?.() } catch {}
    try { realtimeSessionRef.current?.disconnect?.() } catch {}
    realtimeSessionRef.current = null
    micTrackRef.current = null
    setVoiceEngineMode('off')
    voiceEngineModeRef.current = 'off'
  }, [clearResumeTimer])

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

  // ─── Phase P2: ページ遷移後の自然な次Action提案（Browser STT fallback専用）──
  // Realtimeモード中はRealtimeモデル自身がNavigation後の発話を処理するためスキップ。
  // Browser STT fallback時のみbrowserTTSで次Actionを提案する。
  const prevPathRef = React.useRef(pathname)
  React.useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = pathname
    if (!isSessionRef.current) return
    if (prev === pathname) return
    // Realtimeモード中はスキップ（Realtime AgentがNavigation後の応答を担う）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return

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
        if (voiceEngineModeRef.current === 'realtime') return
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
        if (voiceEngineModeRef.current === 'realtime') return
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

  // ─── ページ遷移後のBrowser STT failsafe ────────────────────────
  // Realtime中はSDKがMicを管理するためSpeechRecognitionは不要。
  // Fallback(browser)時のみSpeechRecognitionを再起動する。
  React.useEffect(() => {
    if (!isSessionRef.current) return
    // Realtime接続中はスキップ（startListeningの内部guardと二重保護）
    if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
    const timer = setTimeout(() => {
      if (!isSessionRef.current) return
      if (voiceEngineModeRef.current === 'realtime' || voiceEngineModeRef.current === 'realtime-connecting') return
      if (modeRef.current === 'idle') {
        startListeningRef.current()
      }
    }, 700)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // ─── Watchdog: Realtime stuck → 10秒後にState+Mic強制復旧 ────
  // tool_start後にtool_endが発火しなかった場合のSafety net。
  // muteMic(false)でSDK muteも解除し、確実にListening状態へ復帰する。
  React.useEffect(() => {
    if (voiceEngineMode !== 'realtime') return
    if (mode !== 'processing' && mode !== 'working' && mode !== 'speaking') return
    const t = setTimeout(() => {
      if (voiceEngineModeRef.current !== 'realtime') return
      if (modeRef.current !== 'processing' && modeRef.current !== 'working' && modeRef.current !== 'speaking') return
      if (!realtimeSessionRef.current) return
      isSpeakingRef.current = false
      clearResumeTimer()
      muteMic(false)
      setModeSync('listening')
    }, 10_000)
    return () => clearTimeout(t)
  }, [mode, voiceEngineMode, clearResumeTimer, setModeSync, muteMic])

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
    interrupt,
    currentProjectId,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
    voiceEngineMode, setVoiceEngineMode,
    connectRealtime, disconnectRealtime,
    startListening, stopAll, startSession, stopSession, handleUtterance,
    interrupt,
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
