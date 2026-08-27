'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — 純平面 JARVIS Neon HUD (参考画像準拠)
// 上下ホログラム・ビームなし。中央HUDのみ。
// SVG + CSS Animation。Canvas/WebGL 不使用。
// ============================================================

export interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number   // diameter (px)
  isConnecting?: boolean
  onClick?:      () => void
  isHovered?:    boolean
}

// ── State configs: 全てゴールド基調、intensity/speedで差別化 ─
interface SC { i: number; spd: number; p: string; b: string }
const CFG: Record<string, SC> = {
  idle:       { i:0.28, spd:0.32, p:'#B07A06', b:'#FFD700' },
  connecting: { i:0.55, spd:0.65, p:'#CC9A0A', b:'#FFE020' },
  listening:  { i:1.00, spd:1.30, p:'#FFD700', b:'#FFF8C0' },
  processing: { i:0.90, spd:1.90, p:'#FFA800', b:'#FFD060' },
  working:    { i:0.90, spd:2.10, p:'#FFA800', b:'#FFD060' },
  speaking:   { i:1.00, spd:1.10, p:'#FFD700', b:'#FFFFFF' },
  error:      { i:0.60, spd:0.50, p:'#996000', b:'#FFA020' },
}

// ── Japanese subtext ──────────────────────────────────────────
const SUBS: Record<string, string> = {
  idle:'停止中', connecting:'接続中', listening:'聞いています',
  processing:'考えています', working:'処理中', speaking:'応答しています', error:'接続エラー',
}

// ── Fixed particles (36) ──────────────────────────────────────
const DOTS: [number, number][] = [
  [6,.975],[18,.940],[30,.968],[42,.948],[55,.972],[68,.938],[82,.965],[96,.944],
  [110,.970],[124,.941],[138,.967],[152,.945],[166,.973],[180,.940],[194,.968],
  [208,.946],[222,.970],[236,.942],[250,.966],[264,.944],[278,.971],[292,.940],
  [306,.967],[320,.945],[334,.972],[348,.941],[360,.965],
  [24,.910],[72,.915],[120,.908],[168,.914],[216,.910],[264,.912],[312,.908],
  [45,.885],[135,.888],[225,.885],[315,.888],
]

// ── Waveform heights ──────────────────────────────────────────
const WAVE = [.22,.40,.62,.82,.98,1,.90,.75,.90,1,.80,.60,.38,.22]

export function HikaruCore({ mode, size = 340, isConnecting = false, onClick, isHovered = false }: HikaruCoreProps) {
  const key = isConnecting ? 'connecting' : mode
  const { i, spd, p, b } = CFG[key] ?? CFG.idle
  const sub  = SUBS[key] ?? '停止中'
  const isErr = key === 'error'

  const pr = React.useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion:reduce)').matches : false
  ).current

  // Geometry
  const W  = size * 1.04          // slight overflow for particles/glow
  const H  = size * 1.04
  const cx = W / 2
  const cy = H / 2
  const R  = size * 0.474          // outer ring radius

  // Speed helper
  const d = (base: number) => `${pr ? base * 6 : base / spd}s`
  const pd = pr ? '4s' : `${1.9 / spd}s`

  // Opacity helper
  const o = (base: number) => Math.min(1, base * (0.38 + i * 0.72))

  // Ring thickness scale with intensity
  const th = (base: number) => base * (0.65 + i * 0.55)

  // Font sizes
  const fMain = Math.max(14, size * 0.092)
  const fSub  = Math.max(8,  size * 0.042)

  const showWave  = (key === 'listening' || key === 'speaking') && !pr
  const showScan  = (key === 'processing' || key === 'working') && !pr

  // Waveform geometry (inside core)
  const wN   = WAVE.length
  const wW   = R * 0.52
  const wBW  = wW / (wN * 2 - 1)
  const wMaxH = R * 0.11
  const wSX  = cx - wW / 2

  // Hover/active scale
  const scl = isHovered ? 1.012 : 1.0

  return (
    <div
      onClick={onClick}
      title="JARVISをタップして起動 / 停止"
      style={{
        position:'relative', width:W, height:H, flexShrink:0,
        cursor: onClick ? 'pointer' : 'default',
        transform: `scale(${scl})`,
        transition: 'transform .2s ease',
      }}>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes hk-cw  { to { transform:rotate( 360deg); } }
        @keyframes hk-ccw { to { transform:rotate(-360deg); } }
        @keyframes hk-pu  { 0%,100%{opacity:.45;transform:scale(.96)} 50%{opacity:1;transform:scale(1.04)} }
        @keyframes hk-gl  { 0%,100%{opacity:.42} 50%{opacity:1} }
        @keyframes hk-dt  { 0%,100%{opacity:.05;transform:scale(.3)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes hk-sc  { to { transform:rotate(360deg); } }
        @keyframes hk-wv  { 0%{transform:scaleY(.08)} 100%{transform:scaleY(1)} }
        @keyframes hk-er  { 0%,100%{opacity:1} 50%{opacity:.15} }
        @media(prefers-reduced-motion:reduce){[data-jring]{animation-duration:60s!important}}
      `}</style>

      {/* ── Background ambient glow ── */}
      <div style={{
        position:'absolute',
        inset: `-${size * 0.08}px`,
        borderRadius:'50%',
        background:`radial-gradient(ellipse at center,
          rgba(255,215,0,${i*.22}) 0%,
          rgba(255,190,0,${i*.10}) 38%,
          rgba(255,150,0,${i*.04}) 60%,
          transparent 75%)`,
        pointerEvents:'none',
        animation:`hk-gl ${pd} ease-in-out infinite`,
      }}/>

      <svg
        width={W} height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{overflow:'visible',display:'block',position:'relative',zIndex:1}}>

        <defs>
          {/* Neon glow filter - applied to bright rings */}
          <filter id={`hg${size}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`hgs${size}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          {/* Core background gradient */}
          <radialGradient id={`hcg${size}`} cx="50%" cy="44%" r="56%">
            <stop offset="0%"  stopColor={isErr?'#0e0000':key==='working'?'#0a0014':key==='speaking'?'#020a00':'#0c0900'}/>
            <stop offset="100%" stopColor="#010101"/>
          </radialGradient>
          <radialGradient id={`hig${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={b} stopOpacity={i * 0.28}/>
            <stop offset="70%"  stopColor={p} stopOpacity={i * 0.06}/>
            <stop offset="100%" stopColor={p} stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* ═══ 外周 ambient ring (大きめ glow) ═══ */}
        <circle cx={cx} cy={cy} r={R*1.005} fill="none"
          stroke={p} strokeWidth={th(.5)} opacity={o(.22)}/>

        {/* ═══ L1: outermost fine orbit (very slow CW) ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-cw ${d(50)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.980} fill="none" stroke={p}
            strokeWidth={th(.4)} strokeDasharray="1.5 10" opacity={o(.32)}/>
        </g>

        {/* ═══ 48 tick marks (static) ═══ */}
        {Array.from({length:48},(_,ii)=>{
          const a=(ii*7.5*Math.PI)/180, mj=ii%8===0
          const r1=R*(mj?.954:.965), r2=R*.980
          return <line key={ii}
            x1={cx+Math.cos(a)*r1} y1={cy+Math.sin(a)*r1}
            x2={cx+Math.cos(a)*r2} y2={cy+Math.sin(a)*r2}
            stroke={p} strokeWidth={mj?1.2:.5} opacity={mj?o(.48):o(.20)}/>
        })}

        {/* ═══ L2: segment ring CCW ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(36)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.948} fill="none" stroke={p}
            strokeWidth={th(.7)} strokeDasharray="20 6 4 6" opacity={o(.48)}/>
        </g>

        {/* ═══ L3: data band CW ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-cw ${d(28)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.924} fill="none" stroke={b}
            strokeWidth={th(.5)} strokeDasharray="8 3 3 3 8 3 15 3" opacity={o(.42)}
            filter={i>.6?`url(#hgs${size})`:'none'}/>
        </g>

        {/* ═══ L4: broken arc CCW (medium thick) ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(24)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.900} fill="none" stroke={b}
            strokeWidth={th(1.1)} strokeDasharray="45 12 8 12 22 12" opacity={o(.58)}
            filter={i>.5?`url(#hgs${size})`:'none'}/>
          {/* triangle marker */}
          <polygon points={`${cx},${cy-R*.900-4} ${cx-4},${cy-R*.900+2} ${cx+4},${cy-R*.900+2}`}
            fill={b} opacity={o(.80)}/>
        </g>

        {/* ═══ L5: fine data CW ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-cw ${d(20)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.875} fill="none" stroke={p}
            strokeWidth={th(.6)} strokeDasharray="6 2 2 2 6 2 12 2 4 2" opacity={o(.45)}/>
        </g>

        {/* ═══ L6: thick segment ring CCW ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(18)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.850} fill="none" stroke={b}
            strokeWidth={th(1.5)} strokeDasharray="38 10 10 10" opacity={o(.65)}
            filter={i>.55?`url(#hgs${size})`:'none'}/>
        </g>

        {/* ═══ L7: MAIN OUTER BRIGHT RING (CW) ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-cw ${d(15)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.820} fill="none" stroke={b}
            strokeWidth={th(2.2)} strokeDasharray="55 14 12 14 28 14" opacity={o(.78)}
            filter={`url(#hgs${size})`}/>
          {/* 3 orbit indicator dots */}
          {[0,120,240].map((deg,di)=>{
            const a=(deg*Math.PI)/180
            return <circle key={di} cx={cx+Math.cos(a)*R*.820} cy={cy+Math.sin(a)*R*.820}
              r="3.5" fill={b} opacity={o(.90)} filter={`url(#hgs${size})`}/>
          })}
        </g>

        {/* ═══ 4 CROSS INDICATORS at cardinal points ═══ */}
        {[0,90,180,270].map((deg,di)=>{
          const a  = (deg*Math.PI)/180
          const rp = R * .820
          const x0 = cx+Math.cos(a)*rp, y0 = cy+Math.sin(a)*rp
          const len = R * .038
          return (
            <g key={di} opacity={o(.92)} filter={`url(#hgs${size})`}>
              <line x1={x0-Math.cos(a)*len} y1={y0-Math.sin(a)*len}
                    x2={x0+Math.cos(a)*len} y2={y0+Math.sin(a)*len}
                stroke={b} strokeWidth="2.2"/>
              <line x1={x0-Math.sin(a)*len*.6} y1={y0+Math.cos(a)*len*.6}
                    x2={x0+Math.sin(a)*len*.6} y2={y0-Math.cos(a)*len*.6}
                stroke={b} strokeWidth="2.2"/>
            </g>
          )
        })}

        {/* ═══ L8: CCW fine ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(22)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.790} fill="none" stroke={p}
            strokeWidth={th(.8)} strokeDasharray="15 5 5 5" opacity={o(.50)}/>
        </g>

        {/* ═══ L9: 24 inner tick band (static) ═══ */}
        {Array.from({length:24},(_,ii)=>{
          const a=(ii*15*Math.PI)/180, mj=ii%6===0
          const r1=R*(mj?.766:.775), r2=R*.790
          return <line key={ii}
            x1={cx+Math.cos(a)*r1} y1={cy+Math.sin(a)*r1}
            x2={cx+Math.cos(a)*r2} y2={cy+Math.sin(a)*r2}
            stroke={b} strokeWidth={mj?1.2:.6} opacity={mj?o(.55):o(.28)}/>
        })}

        {/* ═══ L10: data segment CW ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-cw ${d(17)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.752} fill="none" stroke={b}
            strokeWidth={th(1.6)} strokeDasharray="42 10 8 10 20 10" opacity={o(.70)}
            filter={i>.5?`url(#hgs${size})`:'none'}/>
        </g>

        {/* ═══ L11: CCW technical dots ring ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(20)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.722} fill="none" stroke={p}
            strokeWidth={th(.7)} strokeDasharray="12 4" opacity={o(.52)}/>
        </g>

        {/* THINKING / WORKING: Scanner */}
        {showScan && (
          <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-sc ${d(2.5)} linear infinite`}}>
            <line x1={cx} y1={cy-R*.700} x2={cx} y2={cy-R*.07}
              stroke={b} strokeWidth=".9" opacity=".72" filter={`url(#hgs${size})`}/>
            <circle cx={cx} cy={cy-R*.700} r="3.5" fill={b} opacity=".95" filter={`url(#hg${size})`}/>
            <path d={`M${cx} ${cy} L${cx} ${cy-R*.700} A${R*.700} ${R*.700} 0 0 1 ${cx+Math.sin(.40)*R*.700} ${cy-Math.cos(.40)*R*.700}`}
              fill={p} opacity=".10"/>
          </g>
        )}

        {/* ═══ L12: BRIGHT INNER ENERGY RING ═══ */}
        <circle cx={cx} cy={cy} r={R*.690} fill="none"
          stroke={b} strokeWidth={th(3.0)} opacity={o(.85)}
          filter={`url(#hg${size})`}
          style={{animation:`hk-gl ${pd} ease-in-out infinite`}}/>

        {/* ═══ L13: CCW fine inner ═══ */}
        <g data-jring style={{transformOrigin:`${cx}px ${cy}px`,animation:`hk-ccw ${d(14)} linear infinite`}}>
          <circle cx={cx} cy={cy} r={R*.658} fill="none" stroke={b}
            strokeWidth={th(.9)} strokeDasharray="18 5" opacity={o(.60)}/>
        </g>

        {/* ═══ L14: inner pulse ring ═══ */}
        <circle cx={cx} cy={cy} r={R*.622} fill="none"
          stroke={p} strokeWidth={th(10)} opacity={i*.18}
          style={{animation:`hk-pu ${pd} ease-in-out infinite`}}/>

        {/* ═══ 6 radial spokes ═══ */}
        {[30,90,150,210,270,330].map((deg,di)=>{
          const a=(deg*Math.PI)/180
          return <line key={di}
            x1={cx+Math.cos(a)*R*.595} y1={cy+Math.sin(a)*R*.595}
            x2={cx+Math.cos(a)*R*.430} y2={cy+Math.sin(a)*R*.430}
            stroke={p} strokeWidth=".6" opacity={o(.30)}/>
        })}

        {/* ═══ Core background ═══ */}
        <circle cx={cx} cy={cy} r={R*.405} fill={`url(#hcg${size})`}/>
        <circle cx={cx} cy={cy} r={R*.385} fill={`url(#hig${size})`}
          style={{animation:`hk-pu ${pd} ease-in-out infinite`}}/>

        {/* ═══ Waveform (LISTENING / SPEAKING) ═══ */}
        {showWave && WAVE.map((h,wi)=>{
          const x=wSX+wi*wBW*2, bH=h*wMaxH
          return <rect key={wi}
            x={x} y={cy+R*.14+bH/2} width={Math.max(1.5,wBW-1)} height={bH} rx="1"
            fill={b} opacity={o(.78)}
            style={{transformOrigin:`${x}px ${cy+R*.14+bH/2}px`,
              animation:`hk-wv ${.35+wi*.07}s ease-in-out ${wi*.055}s infinite alternate`}}/>
        })}

        {/* ═══ Error warning ═══ */}
        {isErr && (
          <text x={cx} y={cy+R*.20} textAnchor="middle"
            fill={b} fontSize={R*.24} fontFamily="monospace" opacity=".9"
            style={{animation:`hk-er .9s ease-in-out infinite`,userSelect:'none'}}>⚠</text>
        )}

        {/* ═══ Particles (36) ═══ */}
        {DOTS.map(([angle,rr],pi)=>{
          const a=(angle*Math.PI)/180, delay=`${(pi*.14)%2.6}s`
          return <circle key={pi}
            cx={cx+Math.cos(a)*R*rr} cy={cy+Math.sin(a)*R*rr}
            r={pi%5===0?2.2:pi%3===0?1.7:1.2} fill={p}
            style={{animation:`hk-dt ${pd} ease-in-out ${delay} infinite`,opacity:i*.60}}/>
        })}

        {/* ═══ JARVIS text ═══ */}
        <text x={cx} y={cy-(showWave?R*.20:isErr?R*.20:R*.08)}
          textAnchor="middle" dominantBaseline="middle"
          fill={b} fontSize={fMain} fontWeight="900"
          letterSpacing=".20em" fontFamily="'Courier New',Courier,monospace"
          opacity=".97"
          style={{
            filter:`drop-shadow(0 0 ${fMain*.30}px ${b}) drop-shadow(0 0 ${fMain*.14}px ${b})`,
            animation:isErr?`hk-er .9s ease-in-out infinite`:undefined,
            userSelect:'none',cursor:onClick?'pointer':'default',
          }}>
          JARVIS
        </text>

        {/* ═══ Sub text (Japanese only) ═══ */}
        <text x={cx} y={cy+(showWave?R*.04:isErr?R*.06:R*.14)}
          textAnchor="middle" dominantBaseline="middle"
          fill={i>.55?b:p} fontSize={fSub}
          letterSpacing=".08em"
          fontFamily="'Hiragino Sans','Yu Gothic',sans-serif"
          opacity=".78"
          style={{userSelect:'none',cursor:onClick?'pointer':'default'}}>
          {sub}
        </text>

        {/* ═══ IDLE dots ═══ */}
        {key==='idle' && (
          <text x={cx} y={cy+R*.24} textAnchor="middle"
            fill={p} fontSize={fSub*.65} letterSpacing=".26em"
            fontFamily="monospace" opacity=".25" style={{userSelect:'none'}}>
            · · · · ·
          </text>
        )}
      </svg>

      {/* ── CSS outer box-shadow glow ── */}
      <div style={{
        position:'absolute',
        inset:0,
        borderRadius:'50%',
        boxShadow:[
          `0 0 ${size*.040}px rgba(255,215,0,${i*.88})`,
          `0 0 ${size*.080}px rgba(255,190,0,${i*.55})`,
          `0 0 ${size*.140}px rgba(255,165,0,${i*.28})`,
          `0 0 ${size*.220}px rgba(255,140,0,${i*.12})`,
        ].join(','),
        pointerEvents:'none',zIndex:2,
        animation:`hk-gl ${pd} ease-in-out infinite`,
      }}/>
    </div>
  )
}
