'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Mic, MicOff, Sparkles } from 'lucide-react'
import { HikaruCore } from '@/components/voice/HikaruCore'
import { useVoiceAssistant } from '@/lib/voice/useVoiceAssistant'

// ============================================================
// /assistant — HIKARU AI 専用音声アシスタント画面
// 黒背景 + AI Core アニメーション + Voice I/O
// ============================================================

const GOLD         = 'oklch(0.73 0.12 78)'
const GOLD_BRIGHT  = 'oklch(0.88 0.13 78)'
const GOLD_DIM     = 'oklch(0.73 0.12 78 / 0.55)'

// VoiceMode用の状態テキスト
const STATE_TEXT: Record<string, { title: string; sub: string }> = {
  idle:       { title: 'HIKARU ONLINE',  sub: '何をお手伝いしますか？'   },
  listening:  { title: 'LISTENING',      sub: '聞いています...'          },
  processing: { title: 'THINKING',       sub: '確認しています...'        },
  speaking:   { title: 'SPEAKING',       sub: '回答しています'           },
  error:      { title: 'ERROR',          sub: 'もう一度お試しください'    },
}

// Quick Commands
const QUICK_COMMANDS = [
  { label: '今日の仕事', utterance: '今日の仕事を教えて' },
  { label: '通知確認',   utterance: '通知を確認して'     },
  { label: 'スケジュール', utterance: 'スケジュールを見せて' },
  { label: 'マニュアル', utterance: 'マニュアルを開いて' },
  { label: 'ホームへ',   utterance: 'ホームに戻って'     },
]

function AssistantPageContent() {
  const searchParams = useSearchParams()
  // Job画面から来た場合にprojectIdを受け取る（?pid=xxx）
  const projectId = searchParams.get('pid') ?? undefined

  const { mode, transcript, response, errorMessage, messages, isSpeechSupported, startListening, stopAll }
    = useVoiceAssistant({ projectId })

  const stateText = STATE_TEXT[mode] ?? STATE_TEXT.idle
  const isError   = mode === 'error'

  const handleMicClick = () => {
    if (mode === 'listening' || mode === 'processing') { stopAll(); return }
    startListening()
  }

  const handleQuickCommand = (utterance: string) => {
    // useVoiceAssistantのhandleUtteranceを呼ぶ代わりに
    // startListeningをシミュレートできないため、
    // ユーザーに音声入力を促す簡易対応
    // V2でdirectUtterance APIを追加予定
    startListening()
  }

  return (
    <div
      className="min-h-dvh flex flex-col items-center justify-start pb-10 relative overflow-x-hidden"
      style={{ background: 'oklch(0.04 0.002 260)' }}
    >
      {/* ── ヘッダー ── */}
      <div
        className="w-full flex items-center justify-between px-5 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${GOLD}1f` }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
          <span
            className="text-sm font-bold tracking-[0.2em] uppercase"
            style={{
              background: `linear-gradient(90deg, ${GOLD}, ${GOLD_BRIGHT})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}
          >
            HIKARU AI
          </span>
        </div>
        <span className="text-[10px] tracking-[0.15em] uppercase" style={{ color: GOLD_DIM }}>
          VOICE ASSISTANT
        </span>
      </div>

      {/* ── メインコンテンツ ── */}
      <div className="flex flex-col items-center justify-center flex-1 w-full px-4 gap-8 pt-8">

        {/* AI Core */}
        <div className="relative flex items-center justify-center">
          <HikaruCore mode={mode} size={220} />
        </div>

        {/* 状態テキスト */}
        <div className="text-center space-y-1.5">
          <p
            className="text-xs font-bold tracking-[0.35em] uppercase"
            style={{ color: isError ? 'oklch(0.62 0.24 22)' : GOLD_DIM }}
          >
            {stateText.title}
          </p>
          <p
            className="text-lg font-light tracking-wide"
            style={{ color: isError ? 'oklch(0.62 0.24 22)' : 'oklch(0.85 0.008 75)' }}
          >
            {errorMessage || stateText.sub}
          </p>
        </div>

        {/* マイクボタン */}
        <button
          onClick={handleMicClick}
          disabled={mode === 'processing'}
          className="flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40"
          style={{
            background: mode === 'listening'
              ? 'oklch(0.62 0.24 22)'
              : mode === 'processing'
              ? 'oklch(0.20 0.005 260)'
              : `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
            boxShadow: mode === 'listening'
              ? '0 0 30px oklch(0.62 0.24 22 / 0.5)'
              : `0 0 30px ${GOLD}60`,
          }}
          aria-label={mode === 'listening' ? '停止' : 'HIKARUに話す'}
        >
          {mode === 'listening'
            ? <MicOff className="h-8 w-8" style={{ color: 'white' }} />
            : <Mic    className="h-8 w-8" style={{ color: 'oklch(0.06 0.003 260)' }} />
          }
        </button>

        {/* 発話・回答 表示エリア */}
        {(transcript || response || messages.length > 0) && (
          <div className="w-full max-w-md space-y-3">
            {messages.slice(-4).map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] rounded-[var(--radius-xl)] px-4 py-2.5 text-sm leading-relaxed"
                  style={msg.role === 'user' ? {
                    background: `${GOLD}25`,
                    border:     `1px solid ${GOLD}40`,
                    color:      GOLD_BRIGHT,
                  } : {
                    background: 'oklch(0.09 0.004 260)',
                    border:     '1px solid oklch(0.15 0.003 260)',
                    color:      'oklch(0.82 0.008 75)',
                  }}
                >
                  {msg.role === 'user' && (
                    <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: GOLD_DIM }}>あなた</p>
                  )}
                  {msg.role === 'assistant' && (
                    <p className="text-[9px] tracking-[0.2em] uppercase mb-1" style={{ color: GOLD_DIM }}>HIKARU</p>
                  )}
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Commands */}
        <div className="w-full max-w-md">
          <p className="text-[9px] tracking-[0.3em] uppercase mb-2 px-1" style={{ color: GOLD_DIM }}>
            QUICK COMMANDS
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => handleQuickCommand(cmd.utterance)}
                disabled={mode === 'processing' || mode === 'listening'}
                className="rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: `${GOLD}14`,
                  border:     `1px solid ${GOLD}35`,
                  color:      GOLD_BRIGHT,
                }}
              >
                {cmd.label}
              </button>
            ))}
          </div>
        </div>

        {/* 非対応ブラウザ通知 */}
        {!isSpeechSupported && (
          <p className="text-xs text-center" style={{ color: 'oklch(0.55 0.008 75)' }}>
            このブラウザでは音声入力を利用できません。<br />Chrome または Safari をお使いください。
          </p>
        )}

        {projectId && (
          <p className="text-[10px]" style={{ color: GOLD_DIM }}>
            案件コンテキスト: {projectId.slice(0, 8)}...
          </p>
        )}
      </div>
    </div>
  )
}

// useSearchParams を使うため Suspense でラップ
export default function AssistantPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-dvh flex items-center justify-center" style={{ background: 'oklch(0.04 0.002 260)' }}>
        <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'oklch(0.73 0.12 78)' }} />
      </div>
    }>
      <AssistantPageContent />
    </React.Suspense>
  )
}
