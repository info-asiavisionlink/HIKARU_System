// ============================================================
// useVoiceAssistant — 共通Voice制御hook
// VoiceButton と AssistantPage の両方で再利用。
// V1ロジックの単一実装箇所。
// ============================================================

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { browserTTS } from '@/lib/voice/tts/browser'
import { resolveLocalIntent } from '@/lib/voice/intent/resolver'
import { getScreenContext } from '@/lib/voice/context/screen'
import type { VoiceMode } from '@/lib/voice/state/types'
import type { SystemActionName } from '@/lib/voice/registry/system.actions'

// ─── STT型補完（ブラウザ標準だがTS定義が不完全）─────────────────
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

export interface VoiceChatMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// ─── L1データ取得 + 音声サマリー ─────────────────────────────
async function fetchL1Summary(action: SystemActionName, projectId?: string): Promise<string> {
  try {
    switch (action) {
      case 'system.get_today_jobs': {
        const res  = await fetch('/api/home/data', { credentials: 'include' })
        if (!res.ok) return '今日の作業情報を取得できませんでした。'
        const data = await res.json()
        const total = data.summary?.total ?? 0
        const inProgress = data.summary?.inProgress ?? 0
        if (total === 0) return '今日の担当作業はまだありません。'
        const projectName = data.projects?.[0]?.name
        return inProgress > 0
          ? `今日は${total}件の作業があります。${projectName ? `最初は${projectName}です。` : ''}`
          : `今日は${total}件の作業があります。`
      }
      case 'system.get_notifications': {
        const res  = await fetch('/api/notifications', { credentials: 'include' })
        if (!res.ok) return '通知を取得できませんでした。'
        const data = await res.json()
        const items  = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        const unread = items.filter((n: { is_read?: boolean }) => !n.is_read).length
        return unread === 0 ? '未読の通知はありません。' : `未読の通知が${unread}件あります。`
      }
      case 'system.get_schedule': {
        const res  = await fetch('/api/schedule', { credentials: 'include' })
        if (!res.ok) return 'スケジュールを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return items.length === 0 ? '今後の予定はありません。' : `スケジュールに${items.length}件の予定があります。`
      }
      case 'system.get_shifts': {
        const res  = await fetch('/api/shifts', { credentials: 'include' })
        if (!res.ok) return 'シフトを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return items.length === 0 ? 'シフトはありません。' : `シフトが${items.length}件登録されています。`
      }
      case 'system.get_attendance':
        return '勤怠画面に詳細を表示します。'
      case 'system.get_expenses': {
        const res  = await fetch('/api/expenses', { credentials: 'include' })
        if (!res.ok) return '経費情報を取得できませんでした。'
        const data = await res.json()
        const items   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        const pending = items.filter((e: { status?: string }) => e.status === 'draft' || e.status === 'submitted').length
        return pending === 0 ? '申請中の経費はありません。' : `申請中の経費が${pending}件あります。`
      }
      case 'system.get_manuals': {
        if (!projectId) return 'マニュアルを確認するには案件の画面を開いてください。'
        const res  = await fetch(`/api/jobs/${projectId}/manuals`, { credentials: 'include' })
        if (!res.ok) return 'マニュアルを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        return items.length === 0 ? 'マニュアルはまだ登録されていません。' : `マニュアルが${items.length}件あります。`
      }
      case 'system.get_profile': {
        const res  = await fetch('/api/profile', { credentials: 'include' })
        if (!res.ok) return 'プロフィールを取得できませんでした。'
        const data = await res.json()
        const name = data?.data?.name ?? data?.name
        return name ? `${name}さんのプロフィールです。` : 'プロフィール画面を確認してください。'
      }
      case 'system.get_job_detail': {
        if (!projectId) return '案件の画面を開いてから確認してください。'
        const res  = await fetch(`/api/projects/${projectId}`, { credentials: 'include' })
        if (!res.ok) return '案件情報を取得できませんでした。'
        const data = await res.json()
        const name = data?.data?.name ?? data?.name
        return name ? `現在の案件は${name}です。` : '案件詳細を確認してください。'
      }
      default:
        return ''
    }
  } catch {
    return 'データの取得中にエラーが発生しました。'
  }
}

// ─── L2 ナビゲーション実行 ───────────────────────────────────
function executeL2Navigation(
  action: SystemActionName,
  router:    ReturnType<typeof useRouter>,
  projectId?: string
): string {
  switch (action) {
    case 'system.go_home':            router.push('/home');                              return 'ホームに移動します'
    case 'system.go_back':            router.back();                                    return '前の画面に戻ります'
    case 'system.open_notifications': router.push('/notifications');                    return '通知画面を開きます'
    case 'system.open_schedule':      router.push('/schedule');                         return 'スケジュールを開きます'
    case 'system.open_shifts':        router.push('/shifts');                           return 'シフト管理画面を開きます'
    case 'system.open_attendance':    router.push('/attendance');                       return '勤怠管理画面を開きます'
    case 'system.open_expenses':      router.push('/expenses');                         return '経費申請画面を開きます'
    case 'system.open_profile':       router.push('/profile');                          return 'プロフィール画面を開きます'
    case 'system.open_jobs_list':     router.push('/jobs');                             return '案件一覧を開きます'
    case 'system.open_job':
      if (!projectId) return '案件が特定できません。案件一覧から選んでください。'
      router.push(`/jobs/${projectId}`);                                                return '案件画面を開きます'
    case 'system.open_chat':
    case 'system.ask_manual':
      if (!projectId) return 'AI質問には案件の画面から入ってください。'
      router.push(`/jobs/${projectId}/chat`);                                           return 'AIアシスタントを開きます'
    case 'system.open_manual':
      if (!projectId) return 'マニュアルを開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/manual`);                                         return 'マニュアルを開きます'
    case 'system.open_before_camera':
      if (!projectId) return '案件の画面を開いてからBefore写真を撮影してください。'
      router.push(`/jobs/${projectId}/before`);                                         return 'Before写真画面を開きます'
    case 'system.open_after_camera':
      if (!projectId) return '案件の画面を開いてからAfter写真を撮影してください。'
      router.push(`/jobs/${projectId}/after`);                                          return 'After写真画面を開きます'
    case 'system.open_evaluation':
      if (!projectId) return 'AI評価には案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/evaluation`);                                     return 'AI品質評価画面を開きます'
    case 'system.open_report':
      if (!projectId) return '報告書を開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/report`);                                         return '報告書画面を開きます'
    default:
      return ''
  }
}

// ─── Main Hook ────────────────────────────────────────────────
export interface UseVoiceAssistantOptions {
  projectId?: string
}

export interface UseVoiceAssistantReturn {
  mode:              VoiceMode
  transcript:        string
  response:          string
  errorMessage:      string
  messages:          VoiceChatMessage[]
  isSpeechSupported: boolean
  startListening:    () => void
  stopAll:           () => void
  handleUtterance:   (utterance: string) => Promise<void>
  /** Hands-Free Session */
  isSession:         boolean
  startSession:      () => void
  stopSession:       () => void
}

// セッション終了ワード
const SESSION_STOP_RE = /^(終了|やめて|止めて|ストップ|セッション終了|会話終了|閉じて|おしまい|終わり)$/
// セッション無音タイムアウト (ms)
const SILENCE_TIMEOUT_MS = 28_000

export function useVoiceAssistant({ projectId }: UseVoiceAssistantOptions = {}): UseVoiceAssistantReturn {
  const router   = useRouter()
  const pathname = usePathname()

  const [mode,         setMode]      = React.useState<VoiceMode>('idle')
  const [transcript,   setTranscript]  = React.useState('')
  const [response,     setResponse]    = React.useState('')
  const [errorMessage, setErrorMessage] = React.useState('')
  const [messages,     setMessages]    = React.useState<VoiceChatMessage[]>([])
  const [isSession,    setIsSession]   = React.useState(false)

  const recognitionRef   = React.useRef<SpeechRecognitionInstance | null>(null)
  const modeRef          = React.useRef<VoiceMode>('idle')
  const isSessionRef     = React.useRef(false)
  const silenceTimerRef  = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const startListeningRef = React.useRef<() => void>(() => {})

  const setModeSync = React.useCallback((m: VoiceMode) => {
    modeRef.current = m
    setMode(m)
  }, [])

  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  const clearSilenceTimer = React.useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
  }, [])

  const scheduleSilenceTimeout = React.useCallback(() => {
    clearSilenceTimer()
    silenceTimerRef.current = setTimeout(() => {
      if (!isSessionRef.current) return
      isSessionRef.current = false
      setIsSession(false)
      browserTTS.stop()
      modeRef.current = 'idle'
      setMode('idle')
    }, SILENCE_TIMEOUT_MS)
  }, [clearSilenceTimer])

  // TTS再生 + セッション中は完了後に自動再リスニング
  const speakAndMaybeResume = React.useCallback((text: string) => {
    clearSilenceTimer()
    modeRef.current = 'speaking'
    setMode('speaking')
    browserTTS.speak(text, () => {
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 400)
      } else {
        modeRef.current = 'idle'
        setMode('idle')
      }
    })
  }, [clearSilenceTimer])

  const stopAll = React.useCallback(() => {
    clearSilenceTimer()
    isSessionRef.current = false
    setIsSession(false)
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
  }, [clearSilenceTimer, setModeSync])

  const stopSession = React.useCallback(() => {
    isSessionRef.current = false
    setIsSession(false)
    clearSilenceTimer()
    recognitionRef.current?.abort()
    browserTTS.stop()
    setModeSync('idle')
    setErrorMessage('')
  }, [clearSilenceTimer, setModeSync])

  const finishWithError = React.useCallback((msg: string) => {
    clearSilenceTimer()
    setErrorMessage(msg)
    setModeSync('error')
    setTimeout(() => {
      setModeSync('idle')
      setErrorMessage('')
      if (isSessionRef.current) {
        setTimeout(() => { if (isSessionRef.current) startListeningRef.current() }, 800)
      }
    }, 3500)
  }, [clearSilenceTimer, setModeSync])

  const addMessage = React.useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages(prev => [...prev.slice(-4), { role, text, timestamp: Date.now() }])
  }, [])

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
      const navReply = executeL2Navigation(action, router, projectId)
      const reply    = voiceReply ?? navReply
      setResponse(reply)
      addMessage('assistant', reply)
      speakAndMaybeResume(reply)
      return
    }

    // L1 Read-only
    const l1Summary = await fetchL1Summary(action, projectId)
    const reply = voiceReply ?? l1Summary
    setResponse(reply)
    addMessage('assistant', reply)
    speakAndMaybeResume(reply)
  }, [router, projectId, addMessage, speakAndMaybeResume])

  const handleUtterance = React.useCallback(async (utterance: string) => {
    // セッション停止ワード
    if (isSessionRef.current && SESSION_STOP_RE.test(utterance.trim())) {
      addMessage('user', utterance)
      addMessage('assistant', '会話を終了します')
      isSessionRef.current = false
      setIsSession(false)
      clearSilenceTimer()
      speakAndMaybeResume('会話を終了します')
      return
    }

    setTranscript(utterance)
    addMessage('user', utterance)
    setModeSync('processing')

    const localResult = resolveLocalIntent(utterance)
    if (localResult?.action && localResult.confidence >= 0.6) {
      await executeAction(localResult)
      return
    }

    try {
      const ctx = getScreenContext(pathname)
      const res = await fetch('/api/ai/intent', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          utterance,
          currentPath:       pathname,
          currentResourceId: projectId ?? ctx.currentResourceId,
          contextType:       ctx.contextType,
        }),
      })
      if (!res.ok) { finishWithError('音声アシスタントへの接続に失敗しました。'); return }
      const result: IntentResult = await res.json()
      await executeAction(result)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }, [pathname, projectId, executeAction, finishWithError, addMessage, speakAndMaybeResume, clearSilenceTimer, setModeSync])

  const startListening = React.useCallback(() => {
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    if (modeRef.current === 'speaking') { browserTTS.stop(); setModeSync('idle'); return }
    if (modeRef.current === 'processing') return

    setErrorMessage('')
    setTranscript('')
    setModeSync('listening')

    if (isSessionRef.current) scheduleSilenceTimeout()

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang = 'ja-JP'; rec.continuous = false; rec.interimResults = false; rec.maxAlternatives = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      clearSilenceTimer()
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) { finishWithError('音声を認識できませんでした。'); return }
      handleUtterance(text.trim())
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      clearSilenceTimer()
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
  }, [isSpeechSupported, handleUtterance, finishWithError, setModeSync, scheduleSilenceTimeout, clearSilenceTimer])

  React.useEffect(() => {
    startListeningRef.current = startListening
  }, [startListening])

  const startSession = React.useCallback(() => {
    if (!isSpeechSupported) { finishWithError('このブラウザでは音声入力を利用できません。'); return }
    isSessionRef.current = true
    setIsSession(true)
    startListeningRef.current()
  }, [isSpeechSupported, finishWithError])

  return {
    mode, transcript, response, errorMessage, messages,
    isSpeechSupported, startListening, stopAll, handleUtterance,
    isSession, startSession, stopSession,
  }
}
