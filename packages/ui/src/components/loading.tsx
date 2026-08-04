import * as React from 'react'
import { cn } from '../lib/utils'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Spinner — ゴールドHUDリング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'xs' | 'sm' | 'default' | 'lg' | 'xl'
  color?: 'gold' | 'cyan' | 'white'
}

const spinnerSizes = {
  xs:      'h-3   w-3   border',
  sm:      'h-4   w-4   border-2',
  default: 'h-5   w-5   border-2',
  lg:      'h-7   w-7   border-[3px]',
  xl:      'h-10  w-10  border-[3px]',
}

const spinnerColors = {
  gold:  { borderColor: 'oklch(0.73 0.12 78)', borderTopColor: 'transparent', filter: 'drop-shadow(0 0 6px oklch(0.73 0.12 78 / 0.8))' },
  cyan:  { borderColor: 'oklch(0.85 0.18 198)', borderTopColor: 'transparent', filter: 'drop-shadow(0 0 6px oklch(0.85 0.18 198 / 0.8))' },
  white: { borderColor: 'oklch(0.95 0.008 75)', borderTopColor: 'transparent' },
}

function Spinner({ className, size = 'default', color = 'gold', ...props }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="読み込み中"
      className={cn(
        'inline-block rounded-full',
        'animate-[spin_0.75s_linear_infinite]',
        spinnerSizes[size],
        className
      )}
      style={spinnerColors[color]}
      {...props}
    />
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FullPageLoading — 全画面ローディング
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function FullPageLoading({ message = '読み込み中...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex flex-col items-center justify-center gap-8"
      style={{ background: 'oklch(0.05 0.003 260)' }}>

      {/* 同心リング */}
      <div className="relative flex items-center justify-center">
        <div className="absolute h-24 w-24 rounded-full animate-[breathe_3s_ease-in-out_infinite]"
          style={{ border: '1px solid oklch(0.73 0.12 78 / 0.15)' }} />
        <div className="absolute h-16 w-16 rounded-full animate-[breathe_3s_ease-in-out_infinite_0.5s]"
          style={{ border: '1px solid oklch(0.73 0.12 78 / 0.25)' }} />
        <div className="absolute h-20 w-20 rounded-full animate-[rotate-slow_3s_linear_infinite]"
          style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.60)', borderRight: '1px solid transparent', borderBottom: '1px solid transparent', borderLeft: '1px solid transparent' }} />
        <Spinner size="lg" color="gold" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1 w-1 rounded-full animate-[pulse-soft_1.4s_ease-in-out_infinite]"
              style={{ background: 'oklch(0.73 0.12 78)', animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: 'oklch(0.73 0.12 78 / 0.70)' }}>
          {message}
        </p>
        <p className="text-[9px] tracking-widest"
          style={{ color: 'oklch(0.42 0.007 75)' }}>
          HIKARU AI Platform
        </p>
      </div>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InlineLoading
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function InlineLoading({ message = '処理中...' }: { message?: string }) {
  return (
    <div className="flex items-center gap-2.5 py-3 text-sm">
      <Spinner size="sm" color="gold" />
      <span className="tracking-wide" style={{ color: 'oklch(0.60 0.010 75)' }}>{message}</span>
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LoadingOverlay
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function LoadingOverlay({ visible = true }: { visible?: boolean }) {
  if (!visible) return null
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[inherit]"
      style={{ background: 'oklch(0.09 0.005 255 / 0.85)', backdropFilter: 'blur(8px)' }}>
      <Spinner size="lg" color="gold" />
    </div>
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AILoader — AI処理専用
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface AILoaderProps {
  message?: string
  phase?: 'scanning' | 'analyzing' | 'generating' | 'complete'
}

function AILoader({ message = 'AI解析中...', phase = 'analyzing' }: AILoaderProps) {
  const config = {
    scanning:   { label: 'スキャン中', color: 'oklch(0.68 0.20 230)', glow: 'oklch(0.68 0.20 230 / 0.5)' },
    analyzing:  { label: 'AI解析中',   color: 'oklch(0.73 0.12 78)',  glow: 'oklch(0.73 0.12 78 / 0.5)' },
    generating: { label: '生成中',     color: 'oklch(0.85 0.18 198)', glow: 'oklch(0.85 0.18 198 / 0.5)' },
    complete:   { label: '完了',       color: 'oklch(0.72 0.18 150)', glow: 'oklch(0.72 0.18 150 / 0.5)' },
  }[phase]

  return (
    <div className="flex flex-col items-center gap-4 p-6">
      <div className="relative h-16 w-16 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full animate-[rotate-slow_4s_linear_infinite]"
          style={{ borderTop: `1px solid ${config.color}`, borderRight: '1px solid transparent', borderBottom: '1px solid transparent', borderLeft: '1px solid transparent' }} />
        <div className="absolute inset-2 rounded-full animate-[rotate-slow_3s_linear_infinite]"
          style={{ borderBottom: `1px solid oklch(0.85 0.18 198 / 0.6)`, borderRight: '1px solid transparent', borderTop: '1px solid transparent', borderLeft: '1px solid transparent' }} />
        <Spinner size="default" color={phase === 'generating' ? 'cyan' : 'gold'} />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em]"
          style={{ color: config.color, textShadow: `0 0 12px ${config.glow}` }}>
          {config.label}
        </span>
        <span className="text-sm" style={{ color: 'oklch(0.60 0.010 75)' }}>{message}</span>
      </div>
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1 w-1 rounded-full animate-[pulse-soft_1.4s_ease-in-out_infinite]"
            style={{ background: config.color, animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

export { Spinner, FullPageLoading, InlineLoading, LoadingOverlay, AILoader }
