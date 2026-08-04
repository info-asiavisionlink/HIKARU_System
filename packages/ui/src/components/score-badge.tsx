import * as React from 'react'
import { cn } from '../lib/utils'

type ScoreVariant = 'pass' | 'check' | 'fail'

function getScoreVariant(score: number): ScoreVariant {
  if (score >= 80) return 'pass'
  if (score >= 60) return 'check'
  return 'fail'
}

const scoreConfig: Record<ScoreVariant, {
  label: string; color: string; bg: string; border: string; glow: string; numColor: string
}> = {
  pass:  {
    label: '合格', color: 'oklch(0.72 0.18 150)', bg: 'oklch(0.72 0.18 150/0.10)',
    border: 'oklch(0.72 0.18 150/0.40)', glow: 'oklch(0.72 0.18 150/0.30)',
    numColor: 'oklch(0.72 0.18 150)',
  },
  check: {
    label: '要確認', color: 'oklch(0.82 0.13 78)', bg: 'oklch(0.73 0.12 78/0.10)',
    border: 'oklch(0.73 0.12 78/0.40)', glow: 'oklch(0.73 0.12 78/0.30)',
    numColor: 'oklch(0.82 0.13 78)',
  },
  fail:  {
    label: '再清掃', color: 'oklch(0.65 0.25 27)', bg: 'oklch(0.65 0.25 27/0.10)',
    border: 'oklch(0.65 0.25 27/0.40)', glow: 'oklch(0.65 0.25 27/0.30)',
    numColor: 'oklch(0.65 0.25 27)',
  },
}

interface ScoreBadgeProps {
  score: number
  showLabel?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
}

function ScoreBadge({ score, showLabel = true, size = 'default', className }: ScoreBadgeProps) {
  const variant = getScoreVariant(score)
  const config  = scoreConfig[variant]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[var(--radius-full)] font-semibold',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'default' && 'px-2.5 py-1 text-sm',
        size === 'lg' && 'px-3 py-1.5 text-base',
        className
      )}
      style={{
        color:      config.color,
        background: config.bg,
        border:     `1px solid ${config.border}`,
        boxShadow:  `0 0 10px ${config.glow}`,
      }}
    >
      <span className="tabular-nums">{score}点</span>
      {showLabel && <span style={{ opacity: 0.5 }}>|</span>}
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}

interface ScoreDisplayProps {
  score: number
  label?: string
  className?: string
}

function ScoreDisplay({ score, label, className }: ScoreDisplayProps) {
  const variant = getScoreVariant(score)
  const config  = scoreConfig[variant]

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-2 rounded-[var(--radius-xl)] p-6 relative overflow-hidden', className)}
      style={{
        background: config.bg,
        border:     `1px solid ${config.border}`,
        boxShadow:  `0 0 40px ${config.glow}`,
      }}
    >
      <div className="absolute inset-0 rounded-[inherit]"
        style={{ background: `radial-gradient(circle at center, ${config.glow} 0%, transparent 70%)` }}
      />
      <span className="text-5xl font-bold tabular-nums leading-none relative"
        style={{ color: config.numColor, textShadow: `0 0 30px ${config.color}` }}>
        {score}
      </span>
      <span className="text-sm font-medium relative" style={{ color: config.color }}>
        {label ?? '品質スコア'}
      </span>
      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full relative"
        style={{ color: config.color, background: config.border }}>
        {config.label}
      </span>
    </div>
  )
}

export { ScoreBadge, ScoreDisplay, getScoreVariant, type ScoreVariant }
