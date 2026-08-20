'use client'

import * as React from 'react'
import { Mic, Loader2, Volume2, AlertCircle, X } from 'lucide-react'
import type { VoiceMode } from '@/lib/voice/state/types'

interface VoiceOverlayProps {
  mode:         VoiceMode
  errorMessage?: string
  onClose:      () => void
}

const STATE_CONFIG: Record<VoiceMode, { icon: React.ElementType; label: string; subLabel?: string; animate?: string }> = {
  idle:       { icon: Mic,         label: 'ウェイク中' },
  listening:  { icon: Mic,         label: '聞いています…',   subLabel: '話してください',    animate: 'animate-pulse' },
  processing: { icon: Loader2,     label: 'HIKARUが確認中…', subLabel: '少々お待ちください', animate: 'animate-spin' },
  working:    { icon: Loader2,     label: 'HIKARUが実行中…', subLabel: '処理しています',     animate: 'animate-spin' },
  speaking:   { icon: Volume2,     label: 'HIKARUが回答中',  subLabel: 'もう一度押すとスキップ' },
  error:      { icon: AlertCircle, label: 'エラーが発生しました' },
}

export function VoiceOverlay({ mode, errorMessage, onClose }: VoiceOverlayProps) {
  const cfg  = STATE_CONFIG[mode]
  const Icon = cfg.icon

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
    >
      {/* 閉じるボタン */}
      <button
        onClick={onClose}
        className="absolute top-12 right-5 rounded-full p-2 text-white/60 active:text-white transition-colors"
        aria-label="閉じる"
      >
        <X className="h-6 w-6" />
      </button>

      {/* アイコン */}
      <div className={`
        flex h-24 w-24 items-center justify-center rounded-full mb-5
        ${mode === 'listening'
          ? 'bg-[var(--color-primary)] shadow-[0_0_40px_var(--color-primary)]'
          : mode === 'error'
          ? 'bg-[var(--color-error-muted)]'
          : 'bg-white/10'}
      `}>
        <Icon className={`h-12 w-12 text-white ${cfg.animate ?? ''}`} />
      </div>

      {/* ラベル */}
      <p className="text-white text-xl font-semibold">{cfg.label}</p>
      {cfg.subLabel && !errorMessage && (
        <p className="text-white/60 text-sm mt-1">{cfg.subLabel}</p>
      )}
      {errorMessage && (
        <p className="text-[var(--color-error)] text-sm mt-1 text-center max-w-xs">{errorMessage}</p>
      )}

      {/* 聴取中のアニメーションリング */}
      {mode === 'listening' && (
        <div className="absolute flex h-24 w-24 items-center justify-center rounded-full">
          <div className="absolute h-24 w-24 rounded-full border-2 border-[var(--color-primary)] animate-ping opacity-50" />
        </div>
      )}
    </div>
  )
}
