'use client'

import * as React from 'react'
import { cn } from '../lib/utils'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AIScanner — 波形スキャン演出
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface AIScannerProps {
  active?: boolean
  phase?: 'idle' | 'scanning' | 'analyzing' | 'generating' | 'complete'
  className?: string
}

const phaseConfig = {
  idle:       { label: '待機中',     color: 'oklch(0.42 0.007 75)',   glow: false },
  scanning:   { label: 'スキャン中', color: 'oklch(0.68 0.20 230)',   glow: true  },
  analyzing:  { label: 'AI解析中',   color: 'oklch(0.73 0.12 78)',    glow: true  },
  generating: { label: '生成中',     color: 'oklch(0.85 0.18 198)',   glow: true  },
  complete:   { label: '完了',       color: 'oklch(0.72 0.18 150)',   glow: false },
}

export function AIScanner({ active = true, phase = 'analyzing', className }: AIScannerProps) {
  const config = phaseConfig[phase]
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    if (!active || phase === 'idle' || phase === 'complete') return
    const id = setInterval(() => setTick((t) => t + 1), 80)
    return () => clearInterval(id)
  }, [active, phase])

  const bars = 28
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      {/* Waveform */}
      <div className="flex items-end gap-[2.5px] h-10">
        {Array.from({ length: bars }).map((_, i) => {
          const base = Math.sin((i / bars) * Math.PI) * 0.7 + 0.3
          const animated = active && phase !== 'idle'
            ? base * (0.35 + 0.65 * Math.abs(Math.sin((tick * 0.14 + i * 0.38))))
            : 0.12
          return (
            <div key={i} className="w-1 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(3, animated * 40)}px`,
                background: config.color,
                opacity: 0.45 + animated * 0.55,
                boxShadow: config.glow ? `0 0 4px ${config.color}` : 'none',
              }}
            />
          )
        })}
      </div>

      {/* Phase label */}
      <div className="flex items-center gap-2">
        {active && phase !== 'idle' && phase !== 'complete' && (
          <span className="h-1.5 w-1.5 rounded-full animate-[pulse-soft_1s_ease-in-out_infinite]"
            style={{ background: config.color }} />
        )}
        {phase === 'complete' && (
          <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke={config.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        <span className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: config.color, textShadow: config.glow ? `0 0 12px ${config.color}` : 'none' }}>
          {config.label}
        </span>
      </div>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AIThinking — テキスト生成演出
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface AIThinkingProps {
  texts?: string[]
  interval?: number
  className?: string
}

export function AIThinking({
  texts = ['データを収集中...', 'パターンを解析中...', 'AI推論を実行中...', '結果を生成中...'],
  interval = 1800,
  className,
}: AIThinkingProps) {
  const [index,   setIndex]   = React.useState(0)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => { setIndex((i) => (i + 1) % texts.length); setVisible(true) }, 300)
    }, interval)
    return () => clearInterval(id)
  }, [texts, interval])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm transition-opacity duration-300"
        style={{ color: 'oklch(0.55 0.007 75)', opacity: visible ? 1 : 0 }}>
        {texts[index]}
      </span>
      <span className="inline-flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 w-1 rounded-full animate-[pulse-soft_1.2s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.73 0.12 78)', animationDelay: `${i * 0.15}s` }} />
        ))}
      </span>
    </div>
  )
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   AIHologram — ホログラム風AI演出 (フル)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
interface AIHologramProps {
  phase: 'scanning' | 'analyzing' | 'generating' | 'complete'
  message?: string
  className?: string
}

export function AIHologram({ phase, message, className }: AIHologramProps) {
  const config = phaseConfig[phase]
  return (
    <div className={cn('flex flex-col items-center gap-6 py-8', className)}>
      {/* Hologram ring system */}
      <div className="relative h-24 w-24 flex items-center justify-center">
        {/* Outer ring */}
        <div className="absolute inset-0 rounded-full animate-[rotate-slow_6s_linear_infinite]"
          style={{ border: `1px solid ${config.color}`, opacity: 0.20 }} />
        {/* Middle ring */}
        <div className="absolute inset-3 rounded-full animate-[rotate-slow_4s_linear_infinite]"
          style={{ borderTop: `1px solid ${config.color}`, borderRight: '1px solid transparent', borderBottom: '1px solid transparent', borderLeft: '1px solid transparent', opacity: 0.50 }} />
        {/* Inner */}
        <div className="absolute inset-6 rounded-full animate-[breathe_2s_ease-in-out_infinite]"
          style={{ background: `${config.color}`, opacity: 0.10 }} />
        {/* Center dot */}
        <div className="h-3 w-3 rounded-full animate-[pulse-soft_1.5s_ease-in-out_infinite]"
          style={{ background: config.color, boxShadow: `0 0 20px ${config.color}` }} />
      </div>

      {/* Scanner */}
      <AIScanner phase={phase} active />

      {/* Message */}
      {message && (
        <p className="text-sm text-center" style={{ color: 'oklch(0.55 0.007 75)' }}>
          {message}
        </p>
      )}
    </div>
  )
}
