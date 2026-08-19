'use client'

import * as React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Mic } from 'lucide-react'
import { VoiceOverlay } from './VoiceOverlay'
import { browserTTS } from '@/lib/voice/tts/browser'
import { resolveLocalIntent } from '@/lib/voice/intent/resolver'
import { getScreenContext } from '@/lib/voice/context/screen'
import type { VoiceMode } from '@/lib/voice/state/types'
import type { SystemActionName } from '@/lib/voice/registry/system.actions'

// ============================================================
// VoiceButton — HIKARUに話すボタン
// L0: AI質問 → チャット画面へ
// L1: Read-only → 既存API取得 → 音声で読み上げ
// L2: Navigation → router.push / router.back()
// L3以上: 実行しない
// ============================================================

// Web Speech API 型定義（ブラウザ標準だがTypeScript定義が不完全なため補完）
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string
}
type SpeechRecognitionInstance = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface IntentResult {
  action:     SystemActionName | null
  confidence: number
  params:     Record<string, string>
  voiceReply: string | null
}

// ============================================================
// L1 データ取得 + 音声サマリー生成
// ============================================================

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
        if (unread === 0) return '未読の通知はありません。'
        return `未読の通知が${unread}件あります。`
      }

      case 'system.get_schedule': {
        const today = new Date().toISOString().split('T')[0]
        const res   = await fetch('/api/schedule', { credentials: 'include' })
        if (!res.ok) return 'スケジュールを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        if (items.length === 0) return '今後の予定はありません。'
        return `スケジュールに${items.length}件の予定があります。`
      }

      case 'system.get_shifts': {
        const res  = await fetch('/api/shifts', { credentials: 'include' })
        if (!res.ok) return 'シフトを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        if (items.length === 0) return '登録されているシフトはありません。'
        return `シフトが${items.length}件登録されています。`
      }

      case 'system.get_attendance': {
        const res  = await fetch('/api/attendance', { credentials: 'include' })
        if (!res.ok) return '勤怠情報を取得できませんでした。'
        return '勤怠画面に詳細を表示します。'
      }

      case 'system.get_expenses': {
        const res  = await fetch('/api/expenses', { credentials: 'include' })
        if (!res.ok) return '経費情報を取得できませんでした。'
        const data = await res.json()
        const items   = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        const pending = items.filter((e: { status?: string }) => e.status === 'draft' || e.status === 'submitted').length
        if (pending === 0) return '申請中の経費はありません。'
        return `申請中の経費が${pending}件あります。`
      }

      case 'system.get_manuals': {
        if (!projectId) return 'マニュアルを確認するには案件の画面を開いてください。'
        const res  = await fetch(`/api/jobs/${projectId}/manuals`, { credentials: 'include' })
        if (!res.ok) return 'マニュアルを取得できませんでした。'
        const data = await res.json()
        const items = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])
        if (items.length === 0) return 'この案件のマニュアルはまだ登録されていません。'
        return `マニュアルが${items.length}件あります。`
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

// ============================================================
// L2 Navigation実行
// ============================================================

function executeL2Navigation(
  action: SystemActionName,
  router:    ReturnType<typeof useRouter>,
  projectId?: string
): string {
  switch (action) {
    case 'system.go_home':
      router.push('/home')
      return 'ホームに移動します'

    case 'system.go_back':
      router.back()
      return '前の画面に戻ります'

    case 'system.open_notifications':
      router.push('/notifications')
      return '通知画面を開きます'

    case 'system.open_schedule':
      router.push('/schedule')
      return 'スケジュールを開きます'

    case 'system.open_job':
      if (!projectId) return '案件が特定できません。案件一覧から選んでください。'
      router.push(`/jobs/${projectId}`)
      return '案件画面を開きます'

    case 'system.open_chat':
    case 'system.ask_manual':
      if (!projectId) return 'AI質問には案件の画面から入ってください。'
      router.push(`/jobs/${projectId}/chat`)
      return 'AIアシスタントを開きます'

    case 'system.open_manual':
      if (!projectId) return 'マニュアルを開くには案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/manual`)
      return 'マニュアルを開きます'

    case 'system.open_before_camera':
      if (!projectId) return '案件の画面を開いてからBefore写真を撮影してください。'
      router.push(`/jobs/${projectId}/before`)
      return 'Before写真画面を開きます'

    case 'system.open_after_camera':
      if (!projectId) return '案件の画面を開いてからAfter写真を撮影してください。'
      router.push(`/jobs/${projectId}/after`)
      return 'After写真画面を開きます'

    case 'system.open_evaluation':
      if (!projectId) return 'AI評価には案件の画面を開いてください。'
      router.push(`/jobs/${projectId}/evaluation`)
      return 'AI品質評価画面を開きます'

    default:
      return ''
  }
}

// ============================================================
// メインコンポーネント
// ============================================================

interface VoiceButtonProps {
  projectId?: string  // /jobs/[jobId] から受け取る（= projectId）
}

export function VoiceButton({ projectId }: VoiceButtonProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const [mode, setMode]         = React.useState<VoiceMode>('idle')
  const [errorMsg, setErrorMsg] = React.useState<string | undefined>()
  const [showOverlay, setShowOverlay] = React.useState(false)
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null)

  // Web Speech API 対応確認
  const isSpeechSupported = React.useMemo(() => {
    if (typeof window === 'undefined') return false
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
  }, [])

  // 読み上げ中にボタン押下 → 停止して再度聴取
  const handleButtonClick = () => {
    if (mode === 'speaking') {
      browserTTS.stop()
      setMode('idle')
      setShowOverlay(false)
      return
    }
    if (mode === 'listening') {
      recognitionRef.current?.stop()
      return
    }
    if (mode === 'processing') return

    if (!isSpeechSupported) {
      setErrorMsg('このブラウザでは音声入力を利用できません。')
      setShowOverlay(true)
      setMode('error')
      return
    }

    startListening()
  }

  const startListening = () => {
    setErrorMsg(undefined)
    setMode('listening')
    setShowOverlay(true)

    const SpeechRec = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as new () => SpeechRecognitionInstance
    const rec = new SpeechRec()
    rec.lang             = 'ja-JP'
    rec.continuous       = false
    rec.interimResults   = false
    rec.maxAlternatives  = 1
    recognitionRef.current = rec

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (!text.trim()) {
        finishWithError('音声を認識できませんでした。もう一度お試しください。')
        return
      }
      handleUtterance(text.trim())
    }

    rec.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        finishWithError('マイクの使用を許可してください。')
      } else if (e.error === 'no-speech') {
        finishWithError('音声が検出されませんでした。もう一度お試しください。')
      } else {
        finishWithError('音声認識でエラーが発生しました。')
      }
    }

    rec.onend = () => {
      if (mode === 'listening') setMode('idle')
    }

    try {
      rec.start()
    } catch {
      finishWithError('マイクを起動できませんでした。')
    }
  }

  const finishWithError = (msg: string) => {
    setErrorMsg(msg)
    setMode('error')
    // 3秒後に自動クローズ
    setTimeout(() => {
      setShowOverlay(false)
      setMode('idle')
      setErrorMsg(undefined)
    }, 3000)
  }

  const handleUtterance = async (utterance: string) => {
    setMode('processing')

    // --- ローカルIntent解決（高速・無料）---
    const localResult = resolveLocalIntent(utterance)
    if (localResult && localResult.action && localResult.confidence >= 0.6) {
      await executeAction(localResult)
      return
    }

    // --- gpt-4o-mini Intent解析（自然言語対応）---
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

      if (!res.ok) {
        finishWithError('音声アシスタントへの接続に失敗しました。')
        return
      }

      const result: IntentResult = await res.json()
      await executeAction(result)
    } catch {
      finishWithError('音声アシスタントへの接続に失敗しました。')
    }
  }

  const executeAction = async (result: IntentResult) => {
    const { action, confidence, voiceReply } = result

    // confidence不足 または action=null → 応答して終了
    if (!action || confidence < 0.6) {
      const msg = '発話の意図を理解できませんでした。もう一度お話しください。'
      setMode('speaking')
      browserTTS.speak(msg)
      setTimeout(() => { setShowOverlay(false); setMode('idle') }, 3000)
      return
    }

    // L0（ask_manual）と L2（Navigation）
    if (action === 'system.ask_manual' || action === 'system.open_chat') {
      const navReply = executeL2Navigation(action, router, projectId)
      const reply    = voiceReply ?? navReply
      setMode('speaking')
      browserTTS.speak(reply)
      setTimeout(() => { setShowOverlay(false); setMode('idle') }, 2000)
      return
    }

    // L2: Navigation
    const isNavAction = action.startsWith('system.open_') || action === 'system.go_home' || action === 'system.go_back'
    if (isNavAction) {
      const navReply = executeL2Navigation(action, router, projectId)
      const reply    = voiceReply ?? navReply
      if (!reply) {
        // ナビ不可（projectId未設定等）→ エラー
        finishWithError(navReply || 'この操作は現在実行できません。')
        return
      }
      setMode('speaking')
      browserTTS.speak(reply)
      setTimeout(() => { setShowOverlay(false); setMode('idle') }, 2000)
      return
    }

    // L1: Read-only データ取得
    const l1Summary = await fetchL1Summary(action, projectId)
    const reply = voiceReply ?? l1Summary
    setMode('speaking')
    browserTTS.speak(reply)
    setTimeout(() => { setShowOverlay(false); setMode('idle') }, Math.max(3000, reply.length * 120))
  }

  const handleClose = () => {
    recognitionRef.current?.abort()
    browserTTS.stop()
    setMode('idle')
    setShowOverlay(false)
    setErrorMsg(undefined)
  }

  return (
    <>
      {/* フローティングVoiceボタン（右下固定・BottomNavとの重複を避けるためにbottom-24） */}
      <button
        onClick={handleButtonClick}
        disabled={mode === 'processing'}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 disabled:opacity-50"
        style={{
          background: mode === 'listening'
            ? 'var(--color-error)'
            : 'var(--color-primary)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}
        aria-label="HIKARUに話す"
      >
        <Mic className="h-6 w-6 text-white" />
      </button>

      {/* Overlay */}
      {showOverlay && (
        <VoiceOverlay
          mode={mode}
          errorMessage={errorMsg}
          onClose={handleClose}
        />
      )}
    </>
  )
}
