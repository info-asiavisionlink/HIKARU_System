'use client'

import * as React from 'react'
import { cn } from '@hikaru/ui'

// ============================================================
// スコアカラー
// ============================================================

export function scoreColor(score: number | null, type: 'text' | 'bg' | 'fill' | 'stroke' = 'text'): string {
  if (score == null) {
    return type === 'text' ? 'text-[var(--color-muted-foreground)]' : `${type}-[var(--color-muted)]`
  }
  const c = score >= 75 ? 'success' : score >= 60 ? 'warning' : 'error'
  if (type === 'text')   return `text-[var(--color-${c})]`
  if (type === 'bg')     return `bg-[var(--color-${c}-muted)]`
  if (type === 'fill')   return `fill-[var(--color-${c})]`
  if (type === 'stroke') return `stroke-[var(--color-${c})]`
  return ''
}

export function scoreHex(score: number | null): string {
  if (score == null) return '#a0aec0'
  if (score >= 75) return 'var(--color-success)'
  if (score >= 60) return 'var(--color-warning)'
  return 'var(--color-error)'
}

// ============================================================
// 折れ線グラフ（月別トレンド）
// ============================================================

interface LineChartProps {
  data: { label: string; value: number | null }[]
  height?: number
  className?: string
  showDots?: boolean
}

export function LineChart({ data, height = 120, className, showDots = true }: LineChartProps) {
  const W  = 400
  const H  = height
  const PL = 8
  const PR = 8
  const PT = 12
  const PB = 24

  const validData = data.filter((d) => d.value != null)
  if (validData.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-[var(--color-muted-foreground)]', className)}
        style={{ height }}>
        データなし
      </div>
    )
  }

  const minVal   = Math.max(0, Math.min(...validData.map((d) => d.value!)) - 10)
  const maxVal   = Math.min(100, Math.max(...validData.map((d) => d.value!)) + 10)
  const range    = maxVal - minVal || 1

  const n  = data.length
  const xStep = (W - PL - PR) / Math.max(n - 1, 1)

  const toX = (i: number) => PL + i * xStep
  const toY = (v: number) => PT + (H - PT - PB) * (1 - (v - minVal) / range)

  // Build path
  const points: [number, number][] = data.map((d, i) => [toX(i), toY(d.value ?? minVal)])

  let pathD = ''
  let areaD = ''
  let first = true
  const areaPoints: string[] = []
  let firstValidIdx = -1
  let lastValidIdx  = -1

  data.forEach((d, i) => {
    if (d.value == null) { first = true; return }
    const [x, y] = points[i]
    if (first) {
      pathD += `M ${x} ${y}`
      areaPoints.push(`${x},${y}`)
      if (firstValidIdx < 0) firstValidIdx = i
      first = false
    } else {
      pathD += ` L ${x} ${y}`
      areaPoints.push(`${x},${y}`)
    }
    lastValidIdx = i
  })

  if (areaPoints.length > 0 && firstValidIdx >= 0 && lastValidIdx >= 0) {
    const [lx] = points[lastValidIdx]
    const [fx] = points[firstValidIdx]
    areaD = `M ${fx},${H - PB} L ${areaPoints.join(' L ')} L ${lx},${H - PB} Z`
  }

  // Reference lines
  const refs = [60, 75, 100].filter((v) => v >= minVal && v <= maxVal)

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('w-full', className)}
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* 基準線 */}
      {refs.map((v) => (
        <g key={v}>
          <line
            x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)}
            stroke={v === 75 ? 'var(--color-success)' : 'var(--color-border)'}
            strokeWidth="0.5"
            strokeDasharray="3 3"
            opacity="0.6"
          />
          <text x={PL} y={toY(v) - 2} fontSize="8" fill="var(--color-muted-foreground)" opacity="0.7">
            {v}
          </text>
        </g>
      ))}

      {/* エリア塗りつぶし */}
      {areaD && <path d={areaD} fill="url(#lineGrad)" />}

      {/* 折れ線 */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* ドット */}
      {showDots && data.map((d, i) => {
        if (d.value == null) return null
        const [x, y] = points[i]
        return (
          <circle
            key={i}
            cx={x} cy={y} r="3"
            fill="white"
            stroke="var(--color-primary)"
            strokeWidth="1.5"
          />
        )
      })}

      {/* X軸ラベル */}
      {data.map((d, i) => (
        <text
          key={i}
          x={toX(i)} y={H - 4}
          textAnchor="middle"
          fontSize="9"
          fill="var(--color-muted-foreground)"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}

// ============================================================
// 横棒グラフ（ランキング）
// ============================================================

interface HBarChartProps {
  data: { label: string; value: number | null; sub?: string }[]
  maxValue?: number
  className?: string
}

export function HBarChart({ data, maxValue, className }: HBarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value ?? 0), 1)

  return (
    <div className={cn('space-y-2.5', className)}>
      {data.map((item, i) => {
        const pct = item.value != null ? Math.round((item.value / max) * 100) : 0
        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-foreground)] font-medium truncate max-w-[60%]">
                {item.label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {item.sub && (
                  <span className="text-[var(--color-muted-foreground)]">{item.sub}</span>
                )}
                {item.value != null && (
                  <span className={cn('font-bold tabular-nums', scoreColor(item.value))}>
                    {item.value}点
                  </span>
                )}
              </div>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.value != null
                    ? item.value >= 75 ? 'var(--color-success)'
                      : item.value >= 60 ? 'var(--color-warning)'
                      : 'var(--color-error)'
                    : 'var(--color-muted-foreground)',
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================
// ドーナツグラフ（品質分布）
// ============================================================

interface DonutSegment {
  value: number
  color: string
  label: string
}

interface DonutChartProps {
  segments: DonutSegment[]
  size?: number
  strokeWidth?: number
  centerLabel?: string
  centerValue?: string
  className?: string
}

export function DonutChart({ segments, size = 120, strokeWidth = 20, centerLabel, centerValue, className }: DonutChartProps) {
  const r   = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const cx  = size / 2
  const cy  = size / 2

  const total = segments.reduce((a, s) => a + s.value, 0)
  if (total === 0) {
    return (
      <div className={cn('flex items-center justify-center text-xs text-[var(--color-muted-foreground)]', className)}
        style={{ width: size, height: size }}>
        データなし
      </div>
    )
  }

  let offset = 0
  const arcs = segments.map((seg) => {
    const dash  = (seg.value / total) * circ
    const gap   = circ - dash
    const arc   = { dash, gap, offset, ...seg }
    offset     += dash
    return arc
  })

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${arc.gap}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {centerValue && <span className="text-xl font-bold text-[var(--color-foreground)] leading-none">{centerValue}</span>}
          {centerLabel && <span className="text-[9px] text-[var(--color-muted-foreground)] mt-0.5">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ============================================================
// スコアリング（大きい数値表示）
// ============================================================

export function ScoreRing({ score, size = 96 }: { score: number | null; size?: number }) {
  const r     = (size - 10) / 2
  const circ  = 2 * Math.PI * r
  const pct   = score != null ? score / 100 : 0
  const dash  = pct * circ
  const gap   = circ - dash

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth="8" />
        {score != null && (
          <circle
            cx={size/2} cy={size/2} r={r}
            fill="none"
            stroke={scoreHex(score)}
            strokeWidth="8"
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('font-bold leading-none', scoreColor(score), size >= 80 ? 'text-2xl' : 'text-lg')}>
          {score ?? '—'}
        </span>
        {score != null && <span className="text-[9px] text-[var(--color-muted-foreground)]">点</span>}
      </div>
    </div>
  )
}

// ============================================================
// ミニスパークライン
// ============================================================

export function Sparkline({ values, width = 80, height = 24 }: {
  values: (number | null)[]
  width?: number
  height?: number
}) {
  const valid = values.filter((v) => v != null) as number[]
  if (valid.length < 2) return null

  const min = Math.min(...valid)
  const max = Math.max(...valid)
  const range = max - min || 1

  const n  = values.length
  const xS = width / (n - 1)

  let pathD = ''
  let first = true
  values.forEach((v, i) => {
    if (v == null) { first = true; return }
    const x = i * xS
    const y = height - ((v - min) / range) * height
    if (first) { pathD += `M ${x} ${y}`; first = false }
    else { pathD += ` L ${x} ${y}` }
  })

  const lastVal = valid[valid.length - 1]
  const color   = lastVal >= 75 ? 'var(--color-success)' : lastVal >= 60 ? 'var(--color-warning)' : 'var(--color-error)'

  return (
    <svg width={width} height={height} className="overflow-visible">
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

// ============================================================
// 縦棒グラフ（月別作業数）
// ============================================================

interface VBarChartProps {
  data: { label: string; value: number }[]
  height?: number
  className?: string
}

export function VBarChart({ data, height = 80, className }: VBarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1)
  const n   = data.length

  return (
    <div className={cn('flex items-end gap-1 w-full', className)} style={{ height: height + 20 }}>
      {data.map((d, i) => {
        const pct = d.value / max
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t-sm bg-[var(--color-primary)] opacity-70 transition-all duration-500"
              style={{ height: `${Math.max(pct * height, d.value > 0 ? 4 : 0)}px` }}
            />
            <span className="text-[9px] text-[var(--color-muted-foreground)] truncate w-full text-center">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
