'use client'
// ============================================================
// SystemVoiceContext — System (Worker) Persistent Voice Provider
// WorkerLayoutに1つだけ配置。ページ遷移後もSessionを維持する。
// useSystemJarvis() で各Pageから消費する。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS }            from '@/lib/voice/tts/browser'
import { resolveLocalIntent }    from '@/lib/voice/intent/resolver'
import { getScreenContext }      from '@/lib/voice/context/screen'
import type {
  VoiceMode, ConversationContext, LastResultData, VoiceSettings,
} from '@/lib/voice/state/types'
import type { SystemActionName } from '@/lib/voice/registry/system.actions'

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

// ─── Context型 ───────────────────────────────────────────────
export interface SystemVoiceContextValue {
  mode:              VoiceMode
  isSession:         boolean
  isStandby:         boolean
  transcript:        string
  response:          string
  errorMessage:      string
  messages:          SystemVoiceChatMessage[]
  voiceSettings:     VoiceSettings
  setVoiceSettings:  (s: VoiceSettings) => void
  isSpeechSupported: boolean
  startListening:    () => void
  stopAll:           () => void
  startSession:      () => void
  stopSession:       () => void
  handleUtterance:   (text: string) => Promise<void>
  currentProjectId:  string | undefined
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

  const [mode,          setMode]             = React.useState<VoiceMode>('idle')
  const [transcript,    setTranscript]       = React.useState('')
  const [response,      setResponse]         = React.useState('')
  const [errorMessage,  setErrorMessage]     = React.useState('')
  const [messages,      setMessages]         = React.useState<SystemVoiceChatMessage[]>([])
  const [isSession,     setIsSession]        = React.useState(false)
  const [isStandby,     setIsStandby]        = React.useState(false)
  const [voiceSettings, setVoiceSettingsSt]  = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS)

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

  const handleUtterance = React.useCallback(async (utterance: string) => {
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

    try {
      const ctx = getScreenContext(pathnameRef.current)
      const recentMessages = messagesRef.current.slice(-6).map(m => ({ role: m.role, content: m.text }))
      // Agent APIへ（多段Tool実行・自然会話対応）
      const res = await fetch('/api/ai/agent', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          utterance,
          currentPath:       pathnameRef.current,
          currentResourceId: projectIdRef.current ?? ctx.currentResourceId,
          contextType:       ctx.contextType,
          recentMessages,
          lastIntent:        conversationCtxRef.current.lastIntent,
          lastResultData:    conversationCtxRef.current.lastResultData,
        }),
      })
      if (!res.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
      const result = await res.json()

      // AgentがToolで収集したリストをConversation Contextへ反映
      if (result.resultData) {
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastResultData: result.resultData,
        }
      }

      // action=null + voiceReply → Agentが直接回答（データ取得済み）
      if (!result.action && result.voiceReply) {
        setResponse(result.voiceReply)
        addMessage('assistant', result.voiceReply)
        conversationCtxRef.current = {
          ...conversationCtxRef.current,
          lastIntent:  'agent.response',
          lastAction:  undefined,
        }
        speakAndMaybeResume(result.voiceReply)
        return
      }

      // action あり → 既存 executeAction（Nav / L1 fallback）
      await executeAction(result)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [executeAction, finishWithError, addMessage, speakAndMaybeResume, clearActivityTimers, scheduleStandby, setModeSync])

  const startListening = React.useCallback(() => {
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
      } else {
        finishWithError('音声認識でエラーが発生しました。')
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
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    isSessionRef.current = true
    setIsSession(true)
    setIsStandby(false)
    scheduleStandby()
    startListeningRef.current()
  }, [isSpeechSupported, finishWithError, scheduleStandby])

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
    startListening, stopAll, startSession, stopSession, handleUtterance,
    currentProjectId,
  }), [
    mode, isSession, isStandby, transcript, response, errorMessage, messages,
    voiceSettings, setVoiceSettings, isSpeechSupported,
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
