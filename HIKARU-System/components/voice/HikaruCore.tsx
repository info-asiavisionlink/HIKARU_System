'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — Organic Aura Sphere + Neon Flow JARVIS HUD
//
// Motion System:
//   1. j-breathe   — Core breathing (scale only, NO translateY)
//   2. j-aura1/2/3 — Aura breathing (scale+opacity)
//   3. j-nfo/j-nfm — Neon Flow strokeDashoffset (max 2 rings)
//   4. j-wave      — Waveform (LISTEN/SPEAK only)
// ============================================================

export interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number
  isConnecting?: boolean
  onClick?:      () => void
  isHovered?:    boolean
}

interface SC {
  glowI:      number
  auraI:      number
  breathDur:  number
  ringSpd:    number
  wave:       boolean
  waveStrong: boolean
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

const SUBS: Record<string, string> = {
  idle:'停止中', connecting:'接続中', listening:'聞いています',
  processing:'考えています', working:'処理中', speaking:'応答しています', error:'接続エラー',
}

// 12 fixed outer particles [angle°, radiusFraction, dotRadius]
const DOTS: [number, number, number][] = [
  [15,.89,1.6],[45,.91,1.3],[75,.88,1.8],[105,.92,1.4],[135,.90,1.5],[165,.88,1.2],
  [195,.92,1.7],[225,.89,1.3],[255,.91,1.6],[285,.88,1.4],[315,.92,1.8],[345,.90,1.2],
]

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
  const R   = size * 0.468
  const cR  = R * 0.360

  const a1R = cR * 1.22
  const a2R = cR * 1.52
  const a3R = cR * 1.85

  // ── Breath durations ──────────────────────────────────────
  const bd  = pr ? 6.0 : breathDur
  const bD0 = `${bd}s`
  const bD1 = `${bd}s`
  const bD2 = `${(bd * 1.18).toFixed(2)}s`
  const bD3 = `${(bd * 1.38).toFixed(2)}s`

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
  const wBotY = cy + cR * 0.50

  // ── Text Y ───────────────────────────────────────────────
  const tMainY = wave ? cy - cR * 0.30 : isErr ? cy - cR * 0.28 : cy - cR * 0.12
  const tSubY  = wave ? cy + cR * 0.08 : isErr ? cy + cR * 0.10 : cy + cR * 0.22

  // ── Neon Flow Ring ───────────────────────────────────────
  const C_outer  = 2 * Math.PI * R * 0.935
  const C_middle = 2 * Math.PI * R * 0.870
  const coBright = Math.round(Math.max(28, C_outer  * 0.058))
  const coMid    = Math.round(Math.max(54, C_outer  * 0.102))
  const cmBright = Math.round(Math.max(22, C_middle * 0.058))
  const cmMid    = Math.round(Math.max(42, C_middle * 0.102))
  // CW  = negative dashoffset direction, CCW = positive
  const nfODur = pr ? '200s' : `${(30 / Math.max(0.05, ringSpd)).toFixed(1)}s`
  const nfMDur = pr ? '260s' : `${(42 / Math.max(0.05, ringSpd)).toFixed(1)}s`

  // ── Fluid Core paths (6 organic curves, clipped to core) ─
  const fp = cR
  const FLUID = [
    { d:`M${(cx-fp*.82).toFixed(1)} ${cy.toFixed(1)} C${(cx-fp*.35).toFixed(1)} ${(cy-fp*.40).toFixed(1)} ${(cx+fp*.35).toFixed(1)} ${(cy+fp*.40).toFixed(1)} ${(cx+fp*.82).toFixed(1)} ${cy.toFixed(1)}`, sw:.90, fo:.86, dl:'0.00s', dur: bd },
    { d:`M${(cx-fp*.68).toFixed(1)} ${(cy-fp*.30).toFixed(1)} Q${cx.toFixed(1)} ${(cy-fp*.52).toFixed(1)} ${(cx+fp*.68).toFixed(1)} ${(cy-fp*.30).toFixed(1)}`,  sw:.58, fo:.60, dl:'0.70s', dur: bd * 1.08 },
    { d:`M${(cx-fp*.68).toFixed(1)} ${(cy+fp*.30).toFixed(1)} Q${cx.toFixed(1)} ${(cy+fp*.52).toFixed(1)} ${(cx+fp*.68).toFixed(1)} ${(cy+fp*.30).toFixed(1)}`,  sw:.58, fo:.60, dl:'1.00s', dur: bd * 1.14 },
    { d:`M${(cx-fp*.58).toFixed(1)} ${(cy-fp*.46).toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(cx+fp*.58).toFixed(1)} ${(cy+fp*.46).toFixed(1)}`,            sw:.46, fo:.40, dl:'0.40s', dur: bd * 1.22 },
    { d:`M${(cx+fp*.58).toFixed(1)} ${(cy-fp*.46).toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${(cx-fp*.58).toFixed(1)} ${(cy+fp*.46).toFixed(1)}`,            sw:.46, fo:.40, dl:'0.40s', dur: bd * 1.30 },
    { d:`M${cx.toFixed(1)} ${(cy-fp*.82).toFixed(1)} C${(cx+fp*.40).toFixed(1)} ${(cy-fp*.35).toFixed(1)} ${(cx-fp*.40).toFixed(1)} ${(cy+fp*.35).toFixed(1)} ${cx.toFixed(1)} ${(cy+fp*.82).toFixed(1)}`, sw:.70, fo:.72, dl:'1.40s', dur: bd * 1.18 },
  ]

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

      {/* ── Keyframes ── */}
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
        @keyframes j-cw  { to { transform:rotate( 360deg); } }
        @keyframes j-nfo { to { stroke-dashoffset: -${Math.round(C_outer)}px } }
        @keyframes j-nfm { to { stroke-dashoffset:  ${Math.round(C_middle)}px } }
        @keyframes j-wave { 0%{transform:scaleY(.08)} 100%{transform:scaleY(1)} }
        @keyframes j-glow { 0%,100%{opacity:.48} 50%{opacity:1} }
        @keyframes j-dot  { 0%,100%{opacity:.06;transform:scale(.45)} 50%{opacity:.82;transform:scale(1.05)} }
        @keyframes j-err  { 0%,100%{opacity:1} 50%{opacity:.15} }
        @keyframes j-fluid {
          0%,100%{opacity:.62} 50%{opacity:1.00}
        }
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
          <radialGradient id={`jcg${size}`} cx="50%" cy="40%" r="56%">
            <stop offset="0%"   stopColor={
              isErr              ? '#160300'
              : key==='working'  ? '#0c0018'
              : key==='speaking' ? '#020e00'
              : '#0c0800'}/>
            <stop offset="100%" stopColor="#010101"/>
          </radialGradient>

          <radialGradient id={`ja1${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pBright} stopOpacity={auraI * .55}/>
            <stop offset="100%" stopColor={pGold}   stopOpacity="0"/>
          </radialGradient>

          <radialGradient id={`ja2${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pGold}  stopOpacity={auraI * .26}/>
            <stop offset="100%" stopColor={pDim}   stopOpacity="0"/>
          </radialGradient>

          <radialGradient id={`ja3${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={pDim}   stopOpacity={auraI * .12}/>
            <stop offset="100%" stopColor={pDim}   stopOpacity="0"/>
          </radialGradient>

          <filter id={`jgf${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`jsf${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>

          {/* Clip to core sphere */}
          <clipPath id={`jcp${size}`}>
            <circle cx={cx} cy={cy} r={cR * .91}/>
          </clipPath>
        </defs>

        {/* ══ Outer tick marks (36, static) ══ */}
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

        {/* ══ NEON FLOW: Outer ring CW ══ */}
        {/* dim base — solid continuous */}
        <circle cx={cx} cy={cy} r={R*.935} fill="none" stroke={pGold}
          strokeWidth={.7 + glowI * .35}
          opacity={.10 + glowI * .07}/>
        {/* mid glow segment */}
        <circle cx={cx} cy={cy} r={R*.935} fill="none" stroke={pGold}
          strokeWidth={1.6 + glowI * 1.1}
          strokeDasharray={`${coMid} ${Math.round(C_outer - coMid)}`}
          opacity={.22 + glowI * .32}
          data-janim
          style={{animation:`j-nfo ${nfODur} linear infinite`}}/>
        {/* bright peak */}
        <circle cx={cx} cy={cy} r={R*.935} fill="none" stroke={pBright}
          strokeWidth={2.4 + glowI * 1.8}
          strokeDasharray={`${coBright} ${Math.round(C_outer - coBright)}`}
          opacity={.45 + glowI * .50}
          filter={glowI > .28 ? `url(#jgf${size})` : 'none'}
          data-janim
          style={{animation:`j-nfo ${nfODur} linear infinite`}}/>

        {/* ══ NEON FLOW: Middle ring CCW ══ */}
        <circle cx={cx} cy={cy} r={R*.870} fill="none" stroke={pGold}
          strokeWidth={.5 + glowI * .28}
          opacity={.08 + glowI * .06}/>
        <circle cx={cx} cy={cy} r={R*.870} fill="none" stroke={pGold}
          strokeWidth={1.3 + glowI * .95}
          strokeDasharray={`${cmMid} ${Math.round(C_middle - cmMid)}`}
          opacity={.18 + glowI * .28}
          data-janim
          style={{animation:`j-nfm ${nfMDur} linear infinite`}}/>
        <circle cx={cx} cy={cy} r={R*.870} fill="none" stroke={pBright}
          strokeWidth={2.0 + glowI * 1.5}
          strokeDasharray={`${cmBright} ${Math.round(C_middle - cmBright)}`}
          opacity={.36 + glowI * .48}
          filter={glowI > .38 ? `url(#jsf${size})` : 'none'}
          data-janim
          style={{animation:`j-nfm ${nfMDur} linear infinite`}}/>

        {/* ══ CONNECTING: spinning arc ══ */}
        {key==='connecting' && (
          <g data-janim style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-cw 2.5s linear infinite`}}>
            <circle cx={cx} cy={cy} r={R*.800} fill="none"
              stroke="#0090E0" strokeWidth="2.0"
              strokeDasharray="40 80" opacity=".62"/>
          </g>
        )}

        {/* ══ Inner ring (static glow) ══ */}
        <circle cx={cx} cy={cy} r={R*.788} fill="none" stroke={pBright}
          strokeWidth={1.6 + glowI * 1.6}
          opacity={.28 + glowI * .52}
          filter={glowI > .40 ? `url(#jgf${size})` : 'none'}
          style={{animation:`j-glow ${bD0} ease-in-out infinite`}}/>

        {/* ══ AURA 3 ══ */}
        <circle cx={cx} cy={cy} r={a3R} fill={`url(#ja3${size})`}
          style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-aura3 ${bD3} ease-in-out 0.55s infinite`,opacity:auraI*.70}}/>

        {/* ══ AURA 2 ══ */}
        <circle cx={cx} cy={cy} r={a2R} fill={`url(#ja2${size})`}
          style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-aura2 ${bD2} ease-in-out 0.30s infinite`,opacity:auraI*.88}}/>

        {/* ══ AURA 1 ══ */}
        <circle cx={cx} cy={cy} r={a1R} fill={`url(#ja1${size})`}
          style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-aura1 ${bD1} ease-in-out 0.12s infinite`,opacity:auraI}}/>

        {/* ══ CORE SPHERE ══ */}
        <circle cx={cx} cy={cy} r={cR} fill={`url(#jcg${size})`}
          style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-breathe ${bD0} ease-in-out infinite`}}/>

        {/* ══ FLUID CORE: 6 organic mesh curves (on top of dark core) ══ */}
        <g clipPath={`url(#jcp${size})`} opacity={auraI * .28}>
          {FLUID.map((f, fi) => (
            <path key={fi} d={f.d} fill="none" stroke={pGold}
              strokeWidth={f.sw}
              opacity={f.fo}
              filter={auraI > .55 ? `url(#jsf${size})` : 'none'}
              style={{animation:`j-fluid ${f.dur.toFixed(2)}s ease-in-out ${f.dl} infinite`}}/>
          ))}
        </g>

        {/* ══ 6 inner core particles ══ */}
        {[0,60,120,180,240,300].map((deg, pi) => {
          const a = (deg * Math.PI) / 180
          return <circle key={pi}
            cx={cx + Math.cos(a) * cR * .58}
            cy={cy + Math.sin(a) * cR * .58}
            r={1.0} fill={pGold}
            style={{
              animation:`j-dot ${bD1} ease-in-out ${((pi * 0.45) % 2.5).toFixed(2)}s infinite`,
              opacity: auraI * .42,
            }}/>
        })}

        {/* Core inner bright ring */}
        <circle cx={cx} cy={cy} r={cR * .86} fill="none" stroke={pBright}
          strokeWidth={2.8 + glowI * 2.8}
          opacity={.22 + glowI * .58}
          filter={glowI > .38 ? `url(#jgf${size})` : 'none'}
          style={{transformOrigin:`${cx}px ${cy}px`,animation:`j-breathe ${bD0} ease-in-out 0.28s infinite`}}/>

        {/* ERROR: red accent ring */}
        {isErr && (
          <circle cx={cx} cy={cy} r={cR * .93}
            fill="none" stroke="#FF3030" strokeWidth="1.5" opacity=".52"
            style={{animation:`j-err 1.3s ease-in-out infinite`}}/>
        )}

        {/* ══ Outer particles (12, opacity/scale only) ══ */}
        {DOTS.map(([angle, rr, ps], pi) => {
          const a=(angle*Math.PI)/180
          return <circle key={pi}
            cx={cx+Math.cos(a)*R*rr} cy={cy+Math.sin(a)*R*rr}
            r={ps} fill={pGold}
            style={{
              animation:`j-dot ${bD1} ease-in-out ${((pi * 0.30) % 3.0).toFixed(2)}s infinite`,
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

        {/* Sub text */}
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
