'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — Organic Aura Sphere JARVIS HUD
//
// Motion System (4種のみ):
//   1. j-breathe   — Core Sphere breathing (scale only, NO translateY)
//   2. j-aura1/2/3 — Aura layer breathing (scale+opacity)
//   3. j-cw / j-ccw — Very slow ring rotation (max 3 rings)
//   4. j-wave      — Waveform bars (LISTEN/SPEAK only)
//
// 全状態で同一Sphere構造。intensityのみが変わる。
// ============================================================

export interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number
  isConnecting?: boolean
  onClick?:      () => void
  isHovered?:    boolean
}

// ── State config ─────────────────────────────────────────────
interface SC {
  glowI:      number    // overall glow 0–1
  auraI:      number    // aura intensity 0–1
  breathDur:  number    // breathing cycle (sec)
  ringSpd:    number    // ring rotation multiplier (1=base)
  wave:       boolean   // waveform visible
  waveStrong: boolean   // waveform amplitude (speaking=true)
}

const CFG: Record<string, SC> = {
  idle:       { glowI:0.12, auraI:0.08, breathDur:5.5, ringSpd:0.06, wave:false, waveStrong:false },
  connecting: { glowI:0.36, auraI:0.30, breathDur:3.5, ringSpd:0.35, wave:false, waveStrong:false },
  listening:  { glowI:0.95, auraI:0.88, breathDur:2.5, ringSpd:0.80, wave:true,  waveStrong:false },
  processing: { glowI:0.76, auraI:0.68, breathDur:2.0, ringSpd:1.15, wave:false, waveStrong:false },
  working:    { glowI:0.80, auraI:0.72, breathDur:1.8, ringSpd:1.30, wave:false, waveStrong:false },
  speaking:   { glowI:1.00, auraI:0.94, breathDur:2.8, ringSpd:0.70, wave:true,  waveStrong:true  },
  error:      { glowI:0.48, auraI:0.36, breathDur:4.2, ringSpd:0.08, wave:false, waveStrong:false },
}

// ── Subtext ───────────────────────────────────────────────────
const SUBS: Record<string, string> = {
  idle:'停止中', connecting:'接続中', listening:'聞いています',
  processing:'考えています', working:'処理中', speaking:'応答しています', error:'接続エラー',
}

// ── 12 fixed particles [angle°, radiusFraction, radius] ──────
const DOTS: [number, number, number][] = [
  [15,.89,1.6],[45,.91,1.3],[75,.88,1.8],[105,.92,1.4],[135,.90,1.5],[165,.88,1.2],
  [195,.92,1.7],[225,.89,1.3],[255,.91,1.6],[285,.88,1.4],[315,.92,1.8],[345,.90,1.2],
]

// ── Waveform heights ──────────────────────────────────────────
const WH = [.28,.52,.76,.94,1,.96,.80,.96,1,.88,.64,.42,.28]

export function HikaruCore({
  mode, size = 340, isConnecting = false, onClick, isHovered = false,
}: HikaruCoreProps) {
  const key  = isConnecting ? 'connecting' : mode
  const cfg  = CFG[key] ?? CFG.idle
  const sub  = SUBS[key] ?? '停止中'
  const isErr = key === 'error'

  const pr = React.useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion:reduce)').matches : false
  ).current

  const { glowI, auraI, breathDur, ringSpd, wave, waveStrong } = cfg

  // ── Geometry ──────────────────────────────────────────────
  const W   = size * 1.04
  const H   = size * 1.04
  const cx  = W / 2
  const cy  = H / 2
  const R   = size * 0.468         // outer ring radius
  const cR  = R * 0.360            // core sphere radius

  // Aura radii (inside rings)
  const a1R = cR * 1.22            // aura 1 (closest)
  const a2R = cR * 1.52            // aura 2
  const a3R = cR * 1.85            // aura 3 (outermost)

  // ── Duration helpers ────────────────────────────────────
  const bd  = pr ? 6.0  : breathDur
  const bD0 = `${bd}s`             // core
  const bD1 = `${bd * 1.00}s`     // aura1
  const bD2 = `${bd * 1.18}s`     // aura2
  const bD3 = `${bd * 1.38}s`     // aura3
  const rD  = (base: number) => `${pr ? base * 10 : base / Math.max(0.01, ringSpd)}s`

  // ── Colors ───────────────────────────────────────────────
  const pGold   = '#FFD700'
  const pBright = '#FFE878'
  const pDim    = '#C89010'

  // ── Font sizes ───────────────────────────────────────────
  const fMain = Math.max(14, size * 0.088)
  const fSub  = Math.max(7,  size * 0.040)

  // ── Waveform geometry ────────────────────────────────────
  const wN    = WH.length
  const wW    = cR * 1.15
  const wBW   = wW / (wN * 2 - 1)
  const wMaxH = cR * (waveStrong ? 0.42 : 0.26)
  const wSX   = cx - wW / 2
  const wBotY = cy + cR * 0.50    // bottom anchor of waveform

  // Text Y positions
  const tMainY = wave ? cy - cR * 0.30 : isErr ? cy - cR * 0.28 : cy - cR * 0.12
  const tSubY  = wave ? cy + cR * 0.08 : isErr ? cy + cR * 0.10 : cy + cR * 0.22

  return (
    <div
      onClick={onClick}
      title="JARVISをタップして起動 / 停止"
      style={{
        position:'relative', width:W, height:H, flexShrink:0,
        cursor: onClick ? 'pointer' : 'default',
        transform:`scale(${isHovered ? 1.010 : 1.0})`,
        transition:'transform .20s ease',
      }}>

      {/* ── Keyframes (4 motion types + helpers) ── */}
      <style>{`
        @keyframes j-breathe {
          0%,100%{transform:scale(.985);opacity:.76}
          50%    {transform:scale(1.015);opacity:1.00}
        }
        @keyframes j-aura1 {
          0%,100%{transform:scale(.968);opacity:.58}
          50%    {transform:scale(1.042);opacity:1.00}
        }
        @keyframes j-aura2 {
          0%,100%{transform:scale(.948);opacity:.36}
          50%    {transform:scale(1.072);opacity:.90}
        }
        @keyframes j-aura3 {
          0%,100%{transform:scale(.928);opacity:.18}
          50%    {transform:scale(1.105);opacity:.65}
        }
        @keyframes j-cw   { to { transform:rotate( 360deg); } }
        @keyframes j-ccw  { to { transform:rotate(-360deg); } }
        @keyframes j-wave { 0%{transform:scaleY(.08)} 100%{transform:scaleY(1)} }
        @keyframes j-glow { 0%,100%{opacity:.48} 50%{opacity:1} }
        @keyframes j-dot  { 0%,100%{opacity:.06;transform:scale(.45)} 50%{opacity:.82;transform:scale(1.05)} }
        @keyframes j-err  { 0%,100%{opacity:1} 50%{opacity:.15} }
        @media(prefers-reduced-motion:reduce){[data-janim]{animation-duration:60s!important}}
      `}</style>

      {/* ── Ambient background glow ── */}
      <div style={{
        position:'absolute', inset:`-${size*.05}px`, borderRadius:'50%',
        background:`radial-gradient(ellipse at center,
          rgba(255,215,0,${glowI*.20}) 0%,
          rgba(255,190,0,${glowI*.08}) 42%,
          transparent 68%)`,
        pointerEvents:'none',
        animation:`j-glow ${bD0} ease-in-out infinite`,
      }}/>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{overflow:'visible',display:'block',position:'relative',zIndex:1}}>
        <defs>
          {/* Core gradient — dark center */}
          <radialGradient id={`jcg${size}`} cx="50%" cy="40%" r="56%">
            <stop offset="0%"   stopColor={
              isErr         ? '#160300'
              : key==='working'  ? '#0c0018'
              : key==='speaking' ? '#020e00'
              : '#0c0800'}/>
            <stop offset="100%" stopColor="#010101"/>
          </radialGradient>

          {/* Aura 1 gradient (closest, gold–transparent) */}
          <radialGradient id={`ja1${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pBright} stopOpacity={auraI * .55}/>
            <stop offset="100%" stopColor={pGold}   stopOpacity="0"/>
          </radialGradient>

          {/* Aura 2 gradient */}
          <radialGradient id={`ja2${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pGold}  stopOpacity={auraI * .26}/>
            <stop offset="100%" stopColor={pDim}   stopOpacity="0"/>
          </radialGradient>

          {/* Aura 3 gradient (outermost, faint) */}
          <radialGradient id={`ja3${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pDim}   stopOpacity={auraI * .12}/>
            <stop offset="100%" stopColor={pDim}   stopOpacity="0"/>
          </radialGradient>

          {/* Neon glow filter */}
          <filter id={`jgf${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`jsf${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ══ RING 1: Outer tick marks (36, static) ══ */}
        {Array.from({length:36},(_,ii) => {
          const a=(ii*10*Math.PI)/180, mj=ii%9===0
          const r1=R*(mj?.950:.963), r2=R*.978
          return <line key={ii}
            x1={cx+Math.cos(a)*r1} y1={cy+Math.sin(a)*r1}
            x2={cx+Math.cos(a)*r2} y2={cy+Math.sin(a)*r2}
            stroke={pGold}
            strokeWidth={mj ? 1.0 : .44}
            opacity={mj ? (.38*glowI+.07) : (.16*glowI+.04)}/>
        })}

        {/* ══ RING 2: Outer segment (very slow CW) ══ */}
        <g data-janim style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-cw ${rD(62)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.935} fill="none" stroke={pGold}
            strokeWidth={.8 + glowI * .55}
            strokeDasharray="36 10 8 10"
            opacity={.32 + glowI * .32}/>
        </g>

        {/* ══ RING 3: Middle segment (very slow CCW) ══ */}
        <g data-janim style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-ccw ${rD(85)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.870} fill="none" stroke={pBright}
            strokeWidth={1.2 + glowI * .90}
            strokeDasharray="52 14 12 14 26 14"
            opacity={.40 + glowI * .38}
            filter={glowI > .45 ? `url(#jsf${size})` : 'none'}/>
        </g>

        {/* ══ CONNECTING: loading arc (1 ring only) ══ */}
        {key==='connecting' && (
          <g data-janim style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-cw ${rD(12)} linear infinite`}}>
            <circle cx={cx} cy={cy} r={R*.800} fill="none"
              stroke="#0090E0" strokeWidth="2.0"
              strokeDasharray="40 80" opacity=".60"/>
          </g>
        )}

        {/* ══ RING 4: Inner ring (static, glow when active) ══ */}
        <circle cx={cx} cy={cy} r={R*.788} fill="none" stroke={pBright}
          strokeWidth={1.6 + glowI * 1.6}
          opacity={.28 + glowI * .52}
          filter={glowI > .40 ? `url(#jgf${size})` : 'none'}
          style={{animation:`j-glow ${bD0} ease-in-out infinite`}}/>

        {/* ══ AURA 3 (outermost) ══ */}
        <circle cx={cx} cy={cy} r={a3R}
          fill={`url(#ja3${size})`}
          style={{
            transformOrigin:`${cx}px ${cy}px`,
            animation:`j-aura3 ${bD3} ease-in-out 0.55s infinite`,
            opacity: auraI * .70,
          }}/>

        {/* ══ AURA 2 ══ */}
        <circle cx={cx} cy={cy} r={a2R}
          fill={`url(#ja2${size})`}
          style={{
            transformOrigin:`${cx}px ${cy}px`,
            animation:`j-aura2 ${bD2} ease-in-out 0.30s infinite`,
            opacity: auraI * .88,
          }}/>

        {/* ══ AURA 1 (closest) ══ */}
        <circle cx={cx} cy={cy} r={a1R}
          fill={`url(#ja1${size})`}
          style={{
            transformOrigin:`${cx}px ${cy}px`,
            animation:`j-aura1 ${bD1} ease-in-out 0.12s infinite`,
            opacity: auraI,
          }}/>

        {/* ══ CORE SPHERE (breathing — NO translateY) ══ */}
        <circle cx={cx} cy={cy} r={cR}
          fill={`url(#jcg${size})`}
          style={{
            transformOrigin:`${cx}px ${cy}px`,
            animation:`j-breathe ${bD0} ease-in-out infinite`,
          }}/>

        {/* Core inner bright ring */}
        <circle cx={cx} cy={cy} r={cR * .86}
          fill="none" stroke={pBright}
          strokeWidth={2.8 + glowI * 2.8}
          opacity={.22 + glowI * .58}
          filter={glowI > .38 ? `url(#jgf${size})` : 'none'}
          style={{
            transformOrigin:`${cx}px ${cy}px`,
            animation:`j-breathe ${bD0} ease-in-out 0.28s infinite`,
          }}/>

        {/* ERROR: red accent ring */}
        {isErr && (
          <circle cx={cx} cy={cy} r={cR * .93}
            fill="none" stroke="#FF3030" strokeWidth="1.5" opacity=".52"
            style={{animation:`j-err 1.3s ease-in-out infinite`}}/>
        )}

        {/* ══ PARTICLES (12, static — opacity/scale only) ══ */}
        {DOTS.map(([angle, rr, ps], pi) => {
          const a=(angle*Math.PI)/180
          const dl = `${(pi * 0.30) % 3.0}s`
          return <circle key={pi}
            cx={cx+Math.cos(a)*R*rr} cy={cy+Math.sin(a)*R*rr}
            r={ps} fill={pGold}
            style={{
              animation:`j-dot ${bD1} ease-in-out ${dl} infinite`,
              opacity: auraI * .55,
            }}/>
        })}

        {/* ══ WAVEFORM (LISTENING / SPEAKING only) ══ */}
        {wave && WH.map((h, wi) => {
          const x = wSX + wi * wBW * 2
          const bH = h * wMaxH
          return <rect key={wi}
            x={x} y={wBotY - bH}
            width={Math.max(1.5, wBW - 1)} height={bH} rx="1"
            fill={pBright} opacity={.76 + glowI * .20}
            style={{
              transformOrigin:`${x}px ${wBotY}px`,
              animation:`j-wave ${.34+wi*.07}s ease-in-out ${wi*.055}s infinite alternate`,
            }}/>
        })}

        {/* ERROR warning icon */}
        {isErr && (
          <text x={cx} y={cy + cR * .52}
            textAnchor="middle" fill="#FF4422"
            fontSize={cR * .34} fontFamily="monospace" opacity=".82"
            style={{animation:`j-err 1.3s ease-in-out infinite`,userSelect:'none'}}>
            ⚠
          </text>
        )}

        {/* ══ JARVIS text ══ */}
        <text x={cx} y={tMainY}
          textAnchor="middle" dominantBaseline="middle"
          fill={pBright} fontSize={fMain} fontWeight="900"
          letterSpacing=".20em" fontFamily="'Courier New',Courier,monospace"
          opacity=".97"
          style={{
            filter: glowI > .35
              ? `drop-shadow(0 0 ${fMain*.26}px ${pBright}) drop-shadow(0 0 ${fMain*.11}px ${pGold})`
              : 'none',
            animation: isErr ? `j-err 1.3s ease-in-out infinite` : undefined,
            userSelect:'none',
            cursor: onClick ? 'pointer' : 'default',
          }}>
          JARVIS
        </text>

        {/* Sub text (Japanese only) */}
        <text x={cx} y={tSubY}
          textAnchor="middle" dominantBaseline="middle"
          fill={glowI > .45 ? pBright : pDim}
          fontSize={fSub} letterSpacing=".08em"
          fontFamily="'Hiragino Sans','Yu Gothic',sans-serif"
          opacity={.55 + glowI * .35}
          style={{userSelect:'none',cursor:onClick?'pointer':'default'}}>
          {sub}
        </text>

        {/* IDLE dots */}
        {key==='idle' && (
          <text x={cx} y={cy + cR * .40}
            textAnchor="middle" fill={pDim}
            fontSize={fSub*.62} letterSpacing=".28em"
            fontFamily="monospace" opacity=".20"
            style={{userSelect:'none'}}>
            · · · · ·
          </text>
        )}
      </svg>

      {/* ── Box-shadow neon glow ── */}
      <div style={{
        position:'absolute', inset:0, borderRadius:'50%',
        boxShadow:[
          `0 0 ${size*.036}px rgba(255,215,0,${glowI*.90})`,
          `0 0 ${size*.072}px rgba(255,190,0,${glowI*.54})`,
          `0 0 ${size*.128}px rgba(255,165,0,${glowI*.28})`,
          `0 0 ${size*.196}px rgba(255,140,0,${glowI*.12})`,
        ].join(','),
        pointerEvents:'none', zIndex:2,
        animation:`j-glow ${bD0} ease-in-out infinite`,
      }}/>
    </div>
  )
}
