'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — JARVIS型AIコアアニメーション
// CSS/SVGのみ使用。Three.js/Canvas不使用。
// VoiceModeに応じてアニメーション速度・輝度を変化。
// isConnecting: voiceEngineMode === 'realtime-connecting' 時に渡す。
// ============================================================

interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number   // px (default: 240)
  isConnecting?: boolean  // connecting state overlay
}

const COLORS = {
  gold:         'oklch(0.73 0.12 78)',
  goldBright:   'oklch(0.88 0.13 78)',
  goldDark:     'oklch(0.52 0.10 75)',
  goldFaint:    'oklch(0.73 0.12 78 / 0.35)',
  amber:        'oklch(0.65 0.18 55)',
  amberBright:  'oklch(0.80 0.18 55)',
  error:        'oklch(0.62 0.24 22)',
  errorFaint:   'oklch(0.62 0.24 22 / 0.40)',
} as const

interface ModeConfig {
  coreGlow:        string
  ringADuration:   string
  ringBDuration:   string
  ringCDuration:   string
  pulseDuration:   string
  coreBrightness:  string
  particleOpacity: string
}

const MODE_CONFIG: Record<VoiceMode, ModeConfig> = {
  idle: {
    coreGlow:        `0 0 40px ${COLORS.goldDark}, 0 0 80px ${COLORS.goldFaint}`,
    ringADuration:   '8s',
    ringBDuration:   '12s',
    ringCDuration:   '20s',
    pulseDuration:   '3s',
    coreBrightness:  '1',
    particleOpacity: '0.5',
  },
  listening: {
    coreGlow:        `0 0 60px ${COLORS.amber}, 0 0 120px ${COLORS.amberBright}, 0 0 200px ${COLORS.goldFaint}`,
    ringADuration:   '2.5s',
    ringBDuration:   '3.5s',
    ringCDuration:   '8s',
    pulseDuration:   '0.8s',
    coreBrightness:  '1.4',
    particleOpacity: '0.9',
  },
  processing: {
    coreGlow:        `0 0 50px ${COLORS.goldBright}, 0 0 100px ${COLORS.gold}`,
    ringADuration:   '1.5s',
    ringBDuration:   '2s',
    ringCDuration:   '4s',
    pulseDuration:   '0.5s',
    coreBrightness:  '1.6',
    particleOpacity: '1',
  },
  working: {
    coreGlow:        `0 0 45px ${COLORS.gold}, 0 0 90px ${COLORS.goldDark}`,
    ringADuration:   '1.2s',
    ringBDuration:   '1.8s',
    ringCDuration:   '3s',
    pulseDuration:   '0.4s',
    coreBrightness:  '1.5',
    particleOpacity: '1',
  },
  speaking: {
    coreGlow:        `0 0 55px ${COLORS.goldBright}, 0 0 110px ${COLORS.goldBright}`,
    ringADuration:   '3s',
    ringBDuration:   '4s',
    ringCDuration:   '10s',
    pulseDuration:   '1.2s',
    coreBrightness:  '1.3',
    particleOpacity: '0.8',
  },
  error: {
    coreGlow:        `0 0 50px ${COLORS.error}, 0 0 100px ${COLORS.errorFaint}`,
    ringADuration:   '5s',
    ringBDuration:   '7s',
    ringCDuration:   '14s',
    pulseDuration:   '0.4s',
    coreBrightness:  '1',
    particleOpacity: '0.6',
  },
}

// センターテキスト（HUD内に表示）
const MODE_LABELS: Record<VoiceMode, { main: string; sub: string }> = {
  idle:       { main: 'JARVIS', sub: 'STANDBY' },
  listening:  { main: 'LISTEN', sub: '聞いています' },
  processing: { main: 'THINK',  sub: '考えています' },
  working:    { main: 'WORK',   sub: '処理中' },
  speaking:   { main: 'SPEAK',  sub: '応答中' },
  error:      { main: 'ERROR',  sub: 'エラー' },
}

// 小粒子の位置（固定 seed）
const PARTICLES = [
  { angle: 15,  r: 0.88, delay: '0s'    },
  { angle: 72,  r: 0.84, delay: '0.4s'  },
  { angle: 135, r: 0.90, delay: '0.8s'  },
  { angle: 195, r: 0.86, delay: '1.2s'  },
  { angle: 252, r: 0.92, delay: '0.2s'  },
  { angle: 315, r: 0.82, delay: '1.6s'  },
  { angle: 45,  r: 0.78, delay: '0.6s'  },
  { angle: 160, r: 0.94, delay: '1.0s'  },
  { angle: 280, r: 0.80, delay: '1.4s'  },
  { angle: 340, r: 0.88, delay: '0.3s'  },
]

// tick mark 角度（24分割）
const TICKS = Array.from({ length: 24 }, (_, i) => ({
  angle:   (i * 15 * Math.PI) / 180,
  isMajor: i % 6 === 0,
}))

export function HikaruCore({ mode, size = 240, isConnecting = false }: HikaruCoreProps) {
  const cfg       = MODE_CONFIG[mode]
  const isError   = mode === 'error'
  const coreColor = isError ? COLORS.error  : COLORS.goldDark
  const ringColor = isError ? COLORS.error  : isConnecting ? COLORS.amber : COLORS.gold

  const r = size / 2

  const prefersReduced = React.useRef(
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // prefers-reduced-motion: 高速回転を停止し、pulseのみ
  const effectiveRingA = prefersReduced.current ? '20s' : cfg.ringADuration
  const effectiveRingB = prefersReduced.current ? '30s' : cfg.ringBDuration
  const effectiveRingC = prefersReduced.current ? '50s' : cfg.ringCDuration

  const centerLabel = isConnecting
    ? { main: 'LINK', sub: '接続中...' }
    : MODE_LABELS[mode]

  const textColor    = isConnecting ? COLORS.amber : isError ? COLORS.error : COLORS.goldBright
  const textColorSub = isConnecting ? COLORS.amber : isError ? COLORS.error : COLORS.gold

  const mainFontSize = Math.max(9,  size * 0.048)
  const subFontSize  = Math.max(6,  size * 0.030)

  const showScanner = !prefersReduced.current && (mode === 'processing' || mode === 'working')

  return (
    <div
      style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}
      role="img"
      aria-label={`HIKARU AI Core - ${isConnecting ? 'connecting' : mode}`}
    >
      <style>{`
        @keyframes hk-ring-cw   { from { transform: rotate(0deg);    } to { transform: rotate(360deg);   } }
        @keyframes hk-ring-ccw  { from { transform: rotate(0deg);    } to { transform: rotate(-360deg);  } }
        @keyframes hk-pulse     { 0%,100% { opacity: 0.6; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.04); } }
        @keyframes hk-glow      { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }
        @keyframes hk-particle  { 0%,100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1); } }
        @keyframes hk-error     { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes hk-scanner   { from { transform: rotate(0deg); }  to { transform: rotate(360deg); } }
        @keyframes hk-connecting-arc { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .hk-wave-bar { animation: none !important; transform: scaleY(0.5) !important; }
        }
      `}</style>

      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible' }}
      >
        {/* ── SVG radial gradient for core ── */}
        <defs>
          <radialGradient id={`hkCoreGrad-${size}`} cx="40%" cy="35%" r="60%">
            <stop offset="0%"   stopColor={COLORS.goldBright} />
            <stop offset="60%"  stopColor={coreColor}          />
            <stop offset="100%" stopColor="oklch(0.08 0.005 260)" />
          </radialGradient>
          <radialGradient id={`hkGlowGrad-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={ringColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={ringColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Tick marks（外周 HUD メモリ）── */}
        {TICKS.map(({ angle, isMajor }, i) => {
          const r1 = r * (isMajor ? 0.875 : 0.912)
          const r2 = r * 0.952
          return (
            <line
              key={i}
              x1={r + Math.cos(angle) * r1}
              y1={r + Math.sin(angle) * r1}
              x2={r + Math.cos(angle) * r2}
              y2={r + Math.sin(angle) * r2}
              stroke={ringColor}
              strokeWidth={isMajor ? 1.2 : 0.5}
              opacity={isMajor ? 0.45 : 0.20}
            />
          )
        })}

        {/* ── Outer HUD ring（ゆっくり時計回り・ダッシュ）── */}
        <g style={{
          transformOrigin: `${r}px ${r}px`,
          animation: `hk-ring-cw ${effectiveRingC} linear infinite`,
        }}>
          <circle
            cx={r} cy={r} r={r * 0.94}
            fill="none"
            stroke={ringColor}
            strokeWidth="0.5"
            strokeDasharray="4 12"
            opacity="0.35"
          />
        </g>

        {/* ── Ring A（反時計回り・中速）── */}
        <g style={{
          transformOrigin: `${r}px ${r}px`,
          animation: `hk-ring-ccw ${effectiveRingB} linear infinite`,
        }}>
          <circle
            cx={r} cy={r} r={r * 0.78}
            fill="none"
            stroke={ringColor}
            strokeWidth="1"
            strokeDasharray="30 10 8 18"
            opacity="0.55"
          />
          {/* 小三角マーカー */}
          <polygon
            points={`${r},${r * 0.215}  ${r - 4},${r * 0.23}  ${r + 4},${r * 0.23}`}
            fill={ringColor}
            opacity="0.8"
          />
        </g>

        {/* ── Ring B（時計回り・高速）── */}
        <g style={{
          transformOrigin: `${r}px ${r}px`,
          animation: `hk-ring-cw ${effectiveRingA} linear infinite`,
        }}>
          <circle
            cx={r} cy={r} r={r * 0.62}
            fill="none"
            stroke={isError ? COLORS.error : COLORS.goldBright}
            strokeWidth="1.5"
            strokeDasharray="18 6"
            opacity="0.65"
          />
        </g>

        {/* ── Inner ring（静的）── */}
        <circle
          cx={r} cy={r} r={r * 0.46}
          fill="none"
          stroke={ringColor}
          strokeWidth="0.5"
          opacity="0.40"
        />

        {/* ── CONNECTING: 点滅するARC ── */}
        {isConnecting && (
          <circle
            cx={r} cy={r} r={r * 0.55}
            fill="none"
            stroke={COLORS.amber}
            strokeWidth="1"
            strokeDasharray="40 20"
            opacity="0.6"
            style={{ animation: `hk-connecting-arc 1.2s ease-in-out infinite` }}
          />
        )}

        {/* ── THINKING / WORKING: Scanner line ── */}
        {showScanner && (
          <g style={{
            transformOrigin: `${r}px ${r}px`,
            animation: `hk-scanner 1.8s linear infinite`,
          }}>
            <line
              x1={r}
              y1={r}
              x2={r}
              y2={r * 0.38}
              stroke={ringColor}
              strokeWidth="0.8"
              opacity="0.55"
            />
            <circle cx={r} cy={r * 0.42} r="2.5" fill={ringColor} opacity="0.85" />
          </g>
        )}

        {/* ── 粒子 ── */}
        {PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180
          const px  = r + Math.cos(rad) * r * p.r
          const py  = r + Math.sin(rad) * r * p.r
          return (
            <circle
              key={i}
              cx={px} cy={py} r="1.5"
              fill={ringColor}
              style={{
                animation: `hk-particle ${cfg.pulseDuration} ease-in-out infinite`,
                animationDelay: p.delay,
                opacity: parseFloat(cfg.particleOpacity),
              }}
            />
          )
        })}

        {/* ── AI Core グロー（外側の光）── */}
        <circle
          cx={r} cy={r} r={r * 0.30}
          fill="none"
          stroke={isError ? COLORS.error : COLORS.goldBright}
          strokeWidth="20"
          opacity="0.08"
          style={{ animation: `hk-glow ${cfg.pulseDuration} ease-in-out infinite` }}
        />

        {/* ── Core 本体 ── */}
        <circle
          cx={r} cy={r} r={r * 0.28}
          fill={`url(#hkCoreGrad-${size})`}
          style={{
            animation: isError
              ? `hk-error ${cfg.pulseDuration} ease-in-out infinite`
              : `hk-pulse ${cfg.pulseDuration} ease-in-out infinite`,
            filter: `brightness(${cfg.coreBrightness}) drop-shadow(${cfg.coreGlow})`,
          }}
        />

        {/* ── Core inner highlight ── */}
        <circle
          cx={r * 0.88} cy={r * 0.82} r={r * 0.07}
          fill="white"
          opacity="0.25"
        />

        {/* ── Radial HUD lines ── */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180
          const x1  = r + Math.cos(rad) * r * 0.50
          const y1  = r + Math.sin(rad) * r * 0.50
          const x2  = r + Math.cos(rad) * r * 0.70
          const y2  = r + Math.sin(rad) * r * 0.70
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={ringColor} strokeWidth="0.5" opacity="0.30" />
          )
        })}

        {/* ── Center Status Text ── */}
        <text
          x={r}
          y={r - mainFontSize * 0.4}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColor}
          fontSize={mainFontSize}
          fontWeight="bold"
          letterSpacing="0.10em"
          fontFamily="'Courier New', Courier, monospace"
          opacity="0.95"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {centerLabel.main}
        </text>
        <text
          x={r}
          y={r + mainFontSize * 1.05}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={textColorSub}
          fontSize={subFontSize}
          letterSpacing="0.06em"
          fontFamily="'Courier New', Courier, monospace"
          opacity="0.60"
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {centerLabel.sub}
        </text>
      </svg>

      {/* CSS glow overlay */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        boxShadow: cfg.coreGlow,
        pointerEvents: 'none',
        animation: `hk-glow ${cfg.pulseDuration} ease-in-out infinite`,
      }} />
    </div>
  )
}
