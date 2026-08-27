'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — 3D Holographic JARVIS HUD
// 参考画像準拠: Top Emitter + Beams + Central Rings + Bottom Projector
// SVG only. No Canvas / WebGL / Three.js.
// ============================================================

export interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number   // central HUD diameter (px)
  isConnecting?: boolean
}

// ── State color system ────────────────────────────────────────
interface C { p: string; b: string; g: string; i: number }

const COLORS: Record<string, C> = {
  idle:       { p:'#C89010', b:'#FFD700', g:'rgba(200,144,16,',  i:0.32 },
  connecting: { p:'#00AFFF', b:'#7FDDFF', g:'rgba(0,175,255,',   i:0.70 },
  listening:  { p:'#FFD700', b:'#FFF090', g:'rgba(255,215,0,',   i:1.00 },
  processing: { p:'#FFB800', b:'#FFD860', g:'rgba(255,184,0,',   i:0.90 },
  working:    { p:'#C030D8', b:'#E880FF', g:'rgba(192,48,216,',  i:0.88 },
  speaking:   { p:'#00E060', b:'#80FFB0', g:'rgba(0,224,96,',    i:1.00 },
  error:      { p:'#FF3030', b:'#FF8888', g:'rgba(255,48,48,',   i:0.80 },
}

// ── Labels ───────────────────────────────────────────────────
const LABELS: Record<string, [string, string]> = {
  idle:       ['JARVIS', 'STANDBY'],
  connecting: ['JARVIS', 'CONNECTING'],
  listening:  ['JARVIS', 'LISTENING'],
  processing: ['JARVIS', 'THINKING'],
  working:    ['JARVIS', 'PROCESSING'],
  speaking:   ['JARVIS', 'SPEAKING'],
  error:      ['JARVIS', 'ERROR'],
}

// ── Speed multiplier ─────────────────────────────────────────
const SPEED: Record<string, number> = {
  idle:0.35, connecting:0.70, listening:1.20,
  processing:1.80, working:2.00, speaking:0.95, error:0.50,
}

// ── Fixed particles ───────────────────────────────────────────
const DOTS = [
  [12,1.06],[32,1.09],[55,1.05],[78,1.08],[100,1.06],[122,1.07],
  [145,1.05],[168,1.09],[192,1.06],[215,1.08],[238,1.05],[260,1.07],
  [282,1.06],[305,1.09],[328,1.05],[350,1.08],
  [20,1.13],[80,1.12],[140,1.13],[200,1.12],[260,1.13],[320,1.12],
  [50,1.16],[170,1.15],[290,1.16],
] as [number,number][]

// ── Wave bar heights ──────────────────────────────────────────
const WAVE = [.28,.50,.72,.92,1,.95,.78,.96,1,.82,.58,.32]

export function HikaruCore({ mode, size = 300, isConnecting = false }: HikaruCoreProps) {
  const key   = isConnecting ? 'connecting' : mode
  const c     = COLORS[key] ?? COLORS.idle
  const [lM, lS] = LABELS[key] ?? LABELS.idle
  const spd   = SPEED[key] ?? 1
  const isErr = key === 'error'

  const { p, b, g, i } = c // primary, bright, glow-prefix, intensity

  const pr = React.useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion:reduce)').matches : false
  ).current

  // SVG layout (normalized)
  const W    = size * 1.05
  const H    = size * 1.82
  const cx   = W / 2

  // Central HUD
  const hudY = H * 0.455
  const R    = size * 0.404   // outer radius

  // Top emitter
  const tY   = H * 0.082
  const tRx  = size * 0.232
  const tRy  = size * 0.038

  // Bottom projector
  const bY   = H * 0.900
  const bRx  = size * 0.346
  const bRy  = size * 0.058

  // Beam
  const bT1  = tY + tRy * 2.2
  const bT2  = hudY - R * 1.05
  const bB1  = hudY + R * 1.05
  const bB2  = bY - bRy * 2.2

  // Speed helper
  const d = (s: number) => `${pr ? s * 5 : s / spd}s`
  const pd = pr ? '4s' : `${1.8 / spd}s`

  // Opacity helper
  const o = (base: number) => Math.min(1, base * (0.45 + i * 0.65))

  // Font sizes
  const fM = Math.max(11, size * 0.086)
  const fS = Math.max(7,  size * 0.044)

  const showWave    = (key === 'listening' || key === 'speaking') && !pr
  const showScan    = (key === 'processing' || key === 'working') && !pr
  const showConnArc = key === 'connecting'

  return (
    <div style={{ position:'relative', width:W, height:H, flexShrink:0 }}>
      <style>{`
        @keyframes j-cw   { to { transform:rotate( 360deg); } }
        @keyframes j-ccw  { to { transform:rotate(-360deg); } }
        @keyframes j-pu   { 0%,100%{opacity:.48;transform:scale(.963)} 50%{opacity:1;transform:scale(1.037)} }
        @keyframes j-gl   { 0%,100%{opacity:.45} 50%{opacity:1} }
        @keyframes j-dot  { 0%,100%{opacity:.06;transform:scale(.35)} 50%{opacity:.92;transform:scale(1.12)} }
        @keyframes j-sc   { to { transform:rotate(360deg); } }
        @keyframes j-bm   { 0%,100%{opacity:.25} 50%{opacity:.90} }
        @keyframes j-wv   { 0%{transform:scaleY(.12)} 100%{transform:scaleY(1)} }
        @keyframes j-er   { 0%,100%{opacity:1} 50%{opacity:.18} }
        @keyframes j-ca   { 0%,100%{opacity:.22;stroke-dashoffset:0} 50%{opacity:.85;stroke-dashoffset:-45} }
      `}</style>

      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow:'visible', display:'block' }}>
        <defs>
          <radialGradient id={`jcg${size}`} cx="50%" cy="43%" r="56%">
            <stop offset="0%"  stopColor={key==='working'?'#150022':key==='speaking'?'#001a0a':key==='connecting'?'#00101e':key==='error'?'#1a0000':'#0c0900'}/>
            <stop offset="100%" stopColor="#020201"/>
          </radialGradient>
          <radialGradient id={`jig${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p} stopOpacity={i*0.28}/>
            <stop offset="100%" stopColor={p} stopOpacity="0"/>
          </radialGradient>
          <radialGradient id={`jag${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={p} stopOpacity={i*0.16}/>
            <stop offset="100%" stopColor={p} stopOpacity="0"/>
          </radialGradient>
          <linearGradient id={`jbt${size}`} gradientUnits="userSpaceOnUse" x1="0" y1={bT1} x2="0" y2={bT2}>
            <stop offset="0%"   stopColor={p} stopOpacity=".08"/>
            <stop offset="50%"  stopColor={b} stopOpacity={i*.88}/>
            <stop offset="100%" stopColor={p} stopOpacity=".18"/>
          </linearGradient>
          <linearGradient id={`jbb${size}`} gradientUnits="userSpaceOnUse" x1="0" y1={bB1} x2="0" y2={bB2}>
            <stop offset="0%"   stopColor={p} stopOpacity=".18"/>
            <stop offset="50%"  stopColor={b} stopOpacity={i*.88}/>
            <stop offset="100%" stopColor={p} stopOpacity=".08"/>
          </linearGradient>
          <filter id={`jfb${size}`}><feGaussianBlur stdDeviation="3.5"/></filter>
          <filter id={`jfs${size}`}><feGaussianBlur stdDeviation="1.8"/></filter>
          <filter id={`jfg${size}`}>
            <feGaussianBlur stdDeviation="4.5" result="glow"/>
            <feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── Ambient background ── */}
        <ellipse cx={cx} cy={hudY} rx={R*1.55} ry={R*1.12}
          fill={`url(#jag${size})`}
          style={{animation:`j-gl ${pd} ease-in-out infinite`}}/>

        {/* ════ TOP HOLOGRAM EMITTER ════ */}
        <ellipse cx={cx} cy={tY} rx={tRx} ry={tRy}
          fill="none" stroke={p} strokeWidth=".4" strokeDasharray="2 9" opacity={o(.38)}/>
        <g style={{transformOrigin:`${cx}px ${tY}px`,animation:`j-ccw ${d(25)} linear infinite`}}>
          <ellipse cx={cx} cy={tY} rx={tRx*.82} ry={tRy*.82}
            fill="none" stroke={p} strokeWidth=".7" strokeDasharray="22 7 4 7" opacity={o(.55)}/>
        </g>
        <g style={{transformOrigin:`${cx}px ${tY}px`,animation:`j-cw ${d(16)} linear infinite`}}>
          <ellipse cx={cx} cy={tY} rx={tRx*.60} ry={tRy*.60}
            fill="none" stroke={b} strokeWidth="1.3" strokeDasharray="14 5" opacity={o(.72)}
            filter={i>.55?`url(#jfs${size})`:'none'}/>
        </g>
        <g style={{transformOrigin:`${cx}px ${tY}px`,animation:`j-ccw ${d(10)} linear infinite`}}>
          <ellipse cx={cx} cy={tY} rx={tRx*.38} ry={tRy*.38}
            fill="none" stroke={b} strokeWidth="2" opacity={o(.82)}
            filter={`url(#jfs${size})`}/>
        </g>
        {/* Top center emitter */}
        <ellipse cx={cx} cy={tY} rx={tRx*.18} ry={tRy*.18}
          fill={b} opacity={i*.50} filter={`url(#jfb${size})`}
          style={{animation:`j-gl ${pd} ease-in-out infinite`}}/>
        <circle cx={cx} cy={tY} r={2.8}
          fill={b} opacity={i*.90} filter={`url(#jfg${size})`}
          style={{animation:`j-gl ${pd} ease-in-out .3s infinite`}}/>

        {/* ════ TOP BEAM ════ */}
        <line x1={cx} y1={bT1} x2={cx} y2={bT2}
          stroke={p} strokeWidth="9" opacity={i*.25}
          filter={`url(#jfb${size})`}
          style={{animation:`j-bm ${pd} ease-in-out infinite`}}/>
        <line x1={cx} y1={bT1} x2={cx} y2={bT2}
          stroke={`url(#jbt${size})`} strokeWidth="1.6"
          style={{animation:`j-bm ${pd} ease-in-out .2s infinite`}}/>
        <line x1={cx} y1={bT1} x2={cx} y2={bT2}
          stroke={b} strokeWidth=".6" opacity={i*.72}
          style={{animation:`j-bm ${pd} ease-in-out .1s infinite`}}/>

        {/* ════ CENTRAL HUD RINGS (10 layers) ════ */}

        {/* L1: Outermost radar (very slow CW) */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-cw ${d(42)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.982} fill="none" stroke={p}
            strokeWidth=".4" strokeDasharray="2 11" opacity={o(.33)}/>
        </g>

        {/* Tick marks 36 (static) */}
        {Array.from({length:36},(_,ii)=>{
          const a=(ii*10*Math.PI)/180, mj=ii%6===0
          const r1=R*(mj?.888:.910), r2=R*.955
          return <line key={ii}
            x1={cx+Math.cos(a)*r1} y1={hudY+Math.sin(a)*r1}
            x2={cx+Math.cos(a)*r2} y2={hudY+Math.sin(a)*r2}
            stroke={p} strokeWidth={mj?1.1:.45} opacity={mj?o(.44):o(.18)}/>
        })}

        {/* L2: Outer segment ring (CCW) */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-ccw ${d(30)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.928} fill="none" stroke={p}
            strokeWidth=".8" strokeDasharray="26 8 5 8" opacity={o(.52)}/>
          <polygon points={`${cx},${hudY-R*.928-3.5} ${cx-3.5},${hudY-R*.928+2} ${cx+3.5},${hudY-R*.928+2}`}
            fill={p} opacity={o(.72)}/>
        </g>

        {/* L3: Broken arc (CW) */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-cw ${d(20)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.876} fill="none" stroke={b}
            strokeWidth="1.3" strokeDasharray="52 15 10 15 26 15" opacity={o(.65)}
            filter={i>.65?`url(#jfs${size})`:'none'}/>
        </g>

        {/* L4: Medium CCW */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-ccw ${d(24)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.826} fill="none" stroke={p}
            strokeWidth="1.5" strokeDasharray="20 6 6 6" opacity={o(.58)}/>
        </g>

        {/* L5: Technical segment CW with dots */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-cw ${d(15)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.776} fill="none" stroke={b}
            strokeWidth="1.8" strokeDasharray="42 10 8 10 22 10" opacity={o(.70)}
            filter={i>.5?`url(#jfs${size})`:'none'}/>
          {[0,120,240].map((deg,di)=>{
            const a=(deg*Math.PI)/180
            return <circle key={di} cx={cx+Math.cos(a)*R*.776} cy={hudY+Math.sin(a)*R*.776}
              r="2.5" fill={b} opacity={o(.82)}/>
          })}
        </g>

        {/* L6: Inner CCW fine */}
        <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-ccw ${d(18)} linear infinite`}}>
          <circle cx={cx} cy={hudY} r={R*.722} fill="none" stroke={p}
            strokeWidth="1.0" strokeDasharray="14 5" opacity={o(.54)}/>
        </g>

        {/* CONNECTING: special orbit arc */}
        {showConnArc && (
          <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-cw ${d(11)} linear infinite`}}>
            <circle cx={cx} cy={hudY} r={R*.668} fill="none"
              stroke={b} strokeWidth="2.2" strokeDasharray="22 11" opacity="0.78"
              style={{animation:`j-ca 1.6s ease-in-out infinite`}}/>
          </g>
        )}

        {/* THINKING / WORKING: Scanner */}
        {showScan && (
          <g style={{transformOrigin:`${cx}px ${hudY}px`,animation:`j-sc ${d(3.2)} linear infinite`}}>
            <line x1={cx} y1={hudY-R*.62} x2={cx} y2={hudY-R*.08}
              stroke={b} strokeWidth=".9" opacity=".72"/>
            <circle cx={cx} cy={hudY-R*.62} r="3.2" fill={b} opacity=".92"/>
            <path d={`M${cx} ${hudY} L${cx} ${hudY-R*.62} A${R*.62} ${R*.62} 0 0 1 ${cx+Math.sin(.38)*R*.62} ${hudY-Math.cos(.38)*R*.62}`}
              fill={p} opacity=".10"/>
          </g>
        )}

        {/* L7: Bright energy ring (glow) */}
        <circle cx={cx} cy={hudY} r={R*.660} fill="none"
          stroke={b} strokeWidth={i>.6?3.8:2.2} opacity={o(.84)}
          filter={i>.45?`url(#jfg${size})`:'none'}
          style={{animation:`j-gl ${pd} ease-in-out infinite`}}/>

        {/* L8: Soft glow fill ring */}
        <circle cx={cx} cy={hudY} r={R*.605} fill="none"
          stroke={p} strokeWidth={i>.6?12:6} opacity={i*.20}
          style={{animation:`j-pu ${pd} ease-in-out infinite`}}/>

        {/* L9: HUD radial spokes */}
        {[30,90,150,210,270,330].map((deg,di)=>{
          const a=(deg*Math.PI)/180
          return <line key={di}
            x1={cx+Math.cos(a)*R*.58} y1={hudY+Math.sin(a)*R*.58}
            x2={cx+Math.cos(a)*R*.41} y2={hudY+Math.sin(a)*R*.41}
            stroke={p} strokeWidth=".5" opacity={o(.33)}/>
        })}

        {/* L10: Core */}
        <circle cx={cx} cy={hudY} r={R*.388} fill={`url(#jcg${size})`}/>
        <circle cx={cx} cy={hudY} r={R*.368} fill={`url(#jig${size})`}
          style={{animation:`j-pu ${pd} ease-in-out infinite`}}/>

        {/* Waveform */}
        {showWave && (() => {
          const n=WAVE.length, tw=R*.56, bw=tw/(n*2-1), mh=R*.128, sx=cx-tw/2
          return WAVE.map((h,wi)=>{
            const x=sx+wi*bw*2, bh=h*mh
            return <rect key={wi} x={x} y={hudY+bh/2} width={Math.max(1.5,bw-1)} height={bh} rx="1"
              fill={b} opacity=".82"
              style={{transformOrigin:`${x}px ${hudY+bh/2}px`,
                animation:`j-wv ${.36+wi*.07}s ease-in-out ${wi*.055}s infinite alternate`}}/>
          })
        })()}

        {/* Error icon */}
        {isErr && (
          <text x={cx} y={hudY+R*.18} textAnchor="middle"
            fill={b} fontSize={R*.22} fontFamily="monospace" opacity=".9"
            style={{animation:`j-er .9s ease-in-out infinite`,userSelect:'none'}}>⚠</text>
        )}

        {/* Center text: JARVIS */}
        <text x={cx} y={hudY-(showWave?R*.24:isErr?R*.24:R*.08)}
          textAnchor="middle" dominantBaseline="middle"
          fill={b} fontSize={fM} fontWeight="900"
          letterSpacing=".16em" fontFamily="'Courier New',Courier,monospace"
          opacity=".96"
          style={{filter:i>.48?`drop-shadow(0 0 ${fM*.32}px ${b})`:'none',
            animation:isErr?`j-er .9s ease-in-out infinite`:undefined,
            userSelect:'none'}}>
          {lM}
        </text>

        {/* Center text: state */}
        <text x={cx} y={hudY+(showWave?R*.04:R*.18)}
          textAnchor="middle" dominantBaseline="middle"
          fill={p} fontSize={fS} letterSpacing=".13em"
          fontFamily="'Courier New',Courier,monospace" opacity=".78"
          style={{userSelect:'none'}}>
          {lS}
        </text>

        {/* Idle dots */}
        {key==='idle' && (
          <text x={cx} y={hudY+R*.30} textAnchor="middle"
            fill={p} fontSize={fS*.68} letterSpacing=".24em"
            fontFamily="monospace" opacity=".32" style={{userSelect:'none'}}>
            · · · · ·
          </text>
        )}

        {/* Particles */}
        {DOTS.map(([angle,rr],pi)=>{
          const a=(angle*Math.PI)/180, delay=`${(pi*.18)%2.8}s`
          return <circle key={pi}
            cx={cx+Math.cos(a)*R*rr} cy={hudY+Math.sin(a)*R*rr}
            r={pi%4===0?2.1:pi%3===0?1.6:1.2} fill={p}
            style={{animation:`j-dot ${pd} ease-in-out ${delay} infinite`,opacity:i*.65}}/>
        })}

        {/* ════ BOTTOM BEAM ════ */}
        <line x1={cx} y1={bB1} x2={cx} y2={bB2}
          stroke={p} strokeWidth="9" opacity={i*.25}
          filter={`url(#jfb${size})`}
          style={{animation:`j-bm ${pd} ease-in-out .4s infinite`}}/>
        <line x1={cx} y1={bB1} x2={cx} y2={bB2}
          stroke={`url(#jbb${size})`} strokeWidth="1.6"
          style={{animation:`j-bm ${pd} ease-in-out .5s infinite`}}/>
        <line x1={cx} y1={bB1} x2={cx} y2={bB2}
          stroke={b} strokeWidth=".6" opacity={i*.68}
          style={{animation:`j-bm ${pd} ease-in-out .3s infinite`}}/>

        {/* ════ BOTTOM HOLOGRAM PROJECTOR ════ */}
        <ellipse cx={cx} cy={bY} rx={bRx} ry={bRy}
          fill="none" stroke={p} strokeWidth=".5" strokeDasharray="3 10" opacity={o(.38)}/>
        <g style={{transformOrigin:`${cx}px ${bY}px`,animation:`j-cw ${d(34)} linear infinite`}}>
          <ellipse cx={cx} cy={bY} rx={bRx*.84} ry={bRy*.84}
            fill="none" stroke={p} strokeWidth=".8" strokeDasharray="28 10 6 10" opacity={o(.55)}/>
        </g>
        <g style={{transformOrigin:`${cx}px ${bY}px`,animation:`j-ccw ${d(22)} linear infinite`}}>
          <ellipse cx={cx} cy={bY} rx={bRx*.66} ry={bRy*.66}
            fill="none" stroke={b} strokeWidth="1.5" strokeDasharray="20 7" opacity={o(.68)}
            filter={i>.55?`url(#jfs${size})`:'none'}/>
        </g>
        <g style={{transformOrigin:`${cx}px ${bY}px`,animation:`j-cw ${d(15)} linear infinite`}}>
          <ellipse cx={cx} cy={bY} rx={bRx*.46} ry={bRy*.46}
            fill="none" stroke={b} strokeWidth="2.2" strokeDasharray="12 4" opacity={o(.80)}
            filter={`url(#jfg${size})`}/>
        </g>
        <g style={{transformOrigin:`${cx}px ${bY}px`,animation:`j-ccw ${d(9)} linear infinite`}}>
          <ellipse cx={cx} cy={bY} rx={bRx*.28} ry={bRy*.28}
            fill="none" stroke={b} strokeWidth="3.0" opacity={o(.88)}
            filter={`url(#jfg${size})`}/>
        </g>
        {/* Bottom center emitter */}
        <ellipse cx={cx} cy={bY} rx={bRx*.14} ry={bRy*.14}
          fill={b} opacity={i*.55} filter={`url(#jfb${size})`}
          style={{animation:`j-gl ${pd} ease-in-out infinite`}}/>
        <circle cx={cx} cy={bY} r={3.8} fill={b} opacity={i*.92}
          filter={`url(#jfg${size})`}
          style={{animation:`j-gl ${pd} ease-in-out .4s infinite`}}/>
        {/* Ground ambient */}
        <ellipse cx={cx} cy={bY+bRy*.6} rx={bRx*1.15} ry={bRy*.9}
          fill={p} opacity={i*.07} filter={`url(#jfb${size})`}/>
      </svg>
    </div>
  )
}
