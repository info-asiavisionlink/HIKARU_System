'use client'
// ============================================================
// MiniVoicePanel — 全ページ共通の小型JARVIS状態インジケーター
// isSession時のみ表示。既存UI操作を妨げないサイズと位置。
// 大型Floating Micは禁止。このPanelは小型テキストのみ。
// ============================================================

import * as React from 'react'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { usePathname }     from 'next/navigation'
import { Radio, X, ChevronDown, ChevronUp } from 'lucide-react'

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

export function MiniVoicePanel() {
  const {
    mode, isSession, isStandby, messages, stopSession,
  } = useSystemJarvis()

  const pathname  = usePathname()
  const [expanded, setExpanded] = React.useState(false)

  // /assistant では非表示（そのページ自体がメインUI）
  if (pathname === '/assistant') return null
  if (!isSession) return null

  const isListening = mode === 'listening'
  const isSpeaking  = mode === 'speaking'
  const isProc      = mode === 'processing'

  const statusLabel = isStandby  ? 'STANDBY'
    : isListening                ? 'LISTENING'
    : isSpeaking                 ? 'SPEAKING'
    : isProc                     ? 'PROCESSING'
    : 'ACTIVE'

  const dotColor = isStandby ? GD
    : isListening             ? '#4ade80'
    : isSpeaking              ? GB
    : G

  const recentMessages = messages.slice(-6)

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1"
      style={{ maxWidth: 280 }}
    >
      {/* 展開時: Conversation */}
      {expanded && recentMessages.length > 0 && (
        <div
          className="w-full rounded-xl p-3 space-y-2 mb-1"
          style={{
            background: 'oklch(0.06 0.003 260 / 0.96)',
            border:     `1px solid ${G}30`,
            backdropFilter: 'blur(12px)',
          }}
        >
          {recentMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-[88%] rounded-lg px-3 py-1.5 text-[11px] leading-snug"
                style={msg.role === 'user'
                  ? { background: `${G}1e`, color: GB }
                  : { background: 'oklch(0.10 0.004 260)', color: 'oklch(0.80 0.008 75)' }
                }
              >
                <span className="text-[8px] tracking-[0.2em] uppercase mr-1" style={{ color: GD }}>
                  {msg.role === 'user' ? 'YOU' : 'JARVIS'}
                </span>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mini indicator バー */}
      <div
        className="flex items-center gap-2 rounded-full px-3 py-1.5 select-none"
        style={{
          background:     'oklch(0.06 0.003 260 / 0.92)',
          border:         `1px solid ${G}40`,
          backdropFilter: 'blur(12px)',
          boxShadow:      `0 0 12px ${G}30`,
        }}
      >
        {/* 状態ドット */}
        <div
          className="h-1.5 w-1.5 rounded-full shrink-0"
          style={{
            background: dotColor,
            boxShadow:  isListening ? `0 0 6px ${dotColor}` : undefined,
            animation:  isListening ? 'mineye-pulse 1s ease-in-out infinite' : undefined,
          }}
        />
        <style>{`@keyframes mineye-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

        <Radio className="h-3 w-3 shrink-0" style={{ color: G }} />

        <span className="text-[10px] font-bold tracking-[0.18em]" style={{ color: GB }}>
          JARVIS
        </span>
        <span className="text-[9px] tracking-[0.12em]" style={{ color: GD }}>
          {statusLabel}
        </span>

        {/* 展開トグル */}
        {recentMessages.length > 0 && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="flex h-4 w-4 items-center justify-center rounded-full transition-colors"
            style={{ color: GD }}
            aria-label={expanded ? '折りたたむ' : '会話を展開'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          </button>
        )}

        {/* 終了 */}
        <button
          onClick={stopSession}
          className="flex h-4 w-4 items-center justify-center rounded-full transition-colors"
          style={{ color: GD }}
          aria-label="JARVIS終了"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}
