'use client'
// ============================================================
// RealtimeVoicePanel — OpenAI Realtime Voice (WebRTC) for System
// @openai/agents/realtime を使用。
// サーバーからEphemeral Tokenを取得→WebRTC接続→音声対話。
// 既存SystemVoiceProviderとは独立。voiceModeで切替。
// API KeyはブラウザへのExposure禁止（Ephemeral Token方式）。
// ============================================================

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import { X, Radio, Mic, MicOff } from 'lucide-react'

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

// Realtime SDKは動的インポート（SSR回避 + ブラウザ専用）
type RealtimeSession = any
type RealtimeAgent   = any

async function loadRealtimeSDK(): Promise<{ RealtimeAgent: any; RealtimeSession: any }> {
  const mod = await import('@openai/agents/realtime')
  return { RealtimeAgent: mod.RealtimeAgent, RealtimeSession: mod.RealtimeSession }
}

export type RealtimeVoiceStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'error'

interface RealtimeVoicePanelProps {
  onStatusChange?: (status: RealtimeVoiceStatus) => void
  onClose:         () => void
}

const REALTIME_MODEL   = 'gpt-realtime-2.1'
const SYSTEM_PROMPT_RT = `あなたはHIKARU Workerアシスタント「JARVIS」です。
清掃業務に携わる従業員の音声アシスタントとして、自然な日本語で会話します。
回答は短く、音声向けに2〜3文以内で。
今日の作業・案件・マニュアル・通知・スケジュールについて答えてください。
Write操作（作業開始・完了・経費申請等）は現在対応していません。`

export function RealtimeVoicePanel({ onStatusChange, onClose }: RealtimeVoicePanelProps) {
  const pathname = usePathname()
  const jarvis   = useSystemJarvis()

  const [status,    setStatus]    = React.useState<RealtimeVoiceStatus>('idle')
  const [error,     setError]     = React.useState<string>('')
  const [transcript, setTranscript] = React.useState<string>('')

  const sessionRef = React.useRef<RealtimeSession | null>(null)
  const isMounted  = React.useRef(true)

  React.useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      sessionRef.current?.disconnect?.()
    }
  }, [])

  const updateStatus = (s: RealtimeVoiceStatus) => {
    if (!isMounted.current) return
    setStatus(s)
    onStatusChange?.(s)
  }

  const connect = React.useCallback(async () => {
    if (status === 'connecting' || status === 'connected') return
    updateStatus('connecting')
    setError('')

    try {
      // 1. サーバーからEphemeral Tokenを取得
      const tokenRes = await fetch('/api/ai/realtime-token', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ model: REALTIME_MODEL }),
      })

      if (!tokenRes.ok) {
        throw new Error('Ephemeral token の取得に失敗しました。')
      }

      const { clientSecret } = await tokenRes.json()
      if (!clientSecret) {
        throw new Error('Ephemeral token が空です。')
      }

      // 2. Realtime SDK を動的インポート（SSR回避）
      const { RealtimeAgent, RealtimeSession } = await loadRealtimeSDK()

      // 3. RealtimeAgent 定義（CONSOLE Toolsとは完全分離）
      const agent: RealtimeAgent = new RealtimeAgent({
        name:         'JARVIS Worker Realtime',
        instructions: SYSTEM_PROMPT_RT,
        model:        REALTIME_MODEL,
      })

      // 4. RealtimeSession 作成 → WebRTC で接続
      const session: RealtimeSession = new RealtimeSession(agent, {
        model: REALTIME_MODEL,
      })

      // イベントハンドラ
      session.on?.('connected', () => { if (isMounted.current) updateStatus('connected') })
      session.on?.('disconnected', () => { if (isMounted.current) updateStatus('idle') })
      session.on?.('error', (err: Error) => {
        if (isMounted.current) {
          setError(err?.message ?? '接続エラーが発生しました。')
          updateStatus('error')
        }
      })
      session.on?.('agent_start_speech', () => { if (isMounted.current) updateStatus('speaking') })
      session.on?.('agent_end_speech',   () => { if (isMounted.current) updateStatus('connected') })
      session.on?.('user_start_speech',  () => { if (isMounted.current) updateStatus('listening') })
      session.on?.('user_end_speech',    () => { if (isMounted.current) updateStatus('connected') })
      session.on?.('user_transcription_done', (text: string) => {
        if (isMounted.current) setTranscript(text)
      })

      // Ephemeral Token でブラウザから直接 OpenAI へ WebRTC 接続
      // API Key はサーバー側のみ。ブラウザへ露出しない。
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
  }, [status])

  const disconnect = React.useCallback(() => {
    sessionRef.current?.disconnect?.()
    sessionRef.current = null
    updateStatus('idle')
    setError('')
    setTranscript('')
  }, [])

  const handleClose = () => {
    disconnect()
    onClose()
  }

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
    connecting: 'oklch(0.70 0.20 55)',  // amber
    connected:  '#4ade80',
    listening:  '#4ade80',
    speaking:   GB,
    error:      'oklch(0.78 0.24 22)',
  }[status]

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ background: 'oklch(0.04 0.002 260 / 0.97)', backdropFilter: 'blur(8px)' }}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-5 py-4"
        style={{ borderBottom: `1px solid ${G}20` }}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: dotColor, boxShadow: status === 'connected' || status === 'listening' ? `0 0 8px ${dotColor}` : undefined }} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: GB }}>
            {VOICE_ASSISTANT_NAME} REALTIME
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase" style={{ color: GD }}>
            WebRTC
          </span>
        </div>
        <button onClick={handleClose} style={{ color: GD }} aria-label="閉じる">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Center */}
      <div className="flex flex-col items-center gap-6 px-8">
        {/* 状態インジケーター */}
        <div
          className="h-32 w-32 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: status === 'listening' || status === 'connected'
              ? `radial-gradient(circle, ${G}30, ${G}10)`
              : `${G}08`,
            border: `2px solid ${status === 'connected' || status === 'listening' ? G : `${G}30`}`,
            boxShadow: status === 'connected' || status === 'listening'
              ? `0 0 40px ${G}40, 0 0 80px ${G}20`
              : 'none',
          }}
        >
          {status === 'idle' || status === 'error' ? (
            <Mic className="h-12 w-12" style={{ color: status === 'error' ? 'oklch(0.78 0.24 22)' : GD }} />
          ) : (
            <Radio
              className="h-12 w-12"
              style={{
                color: status === 'speaking' ? GB : '#4ade80',
                animation: status === 'connecting' ? 'pulse 1s ease-in-out infinite' : undefined,
              }}
            />
          )}
        </div>

        {/* ステータステキスト */}
        <div className="text-center">
          <p className="text-xl font-bold tracking-[0.1em]" style={{ color: GB }}>
            {statusLabel}
          </p>
          {error && (
            <p className="text-sm mt-2" style={{ color: 'oklch(0.78 0.24 22)' }}>{error}</p>
          )}
          {!error && status === 'connected' && (
            <p className="text-xs mt-2" style={{ color: GD }}>
              話しかけてください。割込みも可能です。
            </p>
          )}
          {transcript && (
            <p className="text-sm mt-3 max-w-xs" style={{ color: 'oklch(0.70 0.008 75)' }}>
              {transcript}
            </p>
          )}
        </div>

        {/* Control button */}
        {status === 'idle' || status === 'error' ? (
          <button
            onClick={connect}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${G}, ${GB})`,
              color:      'oklch(0.06 0.003 260)',
            }}
          >
            <Radio className="h-4 w-4" />
            Realtime 開始
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 rounded-full px-6 py-3 font-bold text-sm transition-all active:scale-95"
            style={{
              background: `${G}20`,
              border:     `1px solid ${G}`,
              color:      GB,
            }}
          >
            <MicOff className="h-4 w-4" />
            切断
          </button>
        )}

        <p className="text-[9px] text-center max-w-xs" style={{ color: GD }}>
          API Key はサーバー側のみで管理。ブラウザへは短命トークンのみ送信。
        </p>
      </div>
    </div>
  )
}
