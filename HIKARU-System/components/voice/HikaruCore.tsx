'use client'

import * as React from 'react'
import type { VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HikaruCore — JARVIS HUD (参考画像準拠)
// SVGのみ使用。Canvas/Three.js不使用。
// 8〜10層リング + ネオンゴールド発光 + センターテキスト
// ============================================================

interface HikaruCoreProps {
  mode:          VoiceMode
  size?:         number
  isConnecting?: boolean
}

// ── カラー定義 ──────────────────────────────────────────────
const C = {
  gold:       '#FFD700',
  goldBright: '#FFE878',
  goldSoft:   '#FFCC33',
  goldDim:    '#C8941A',
  goldFaint:  'rgba(255,200,0,0.18)',
  amber:      '#FFB800',
  amberDim:   '#CC8800',
  error:      '#FF4422',
  errorDim:   'rgba(255,60,20,0.35)',
  dark:       '#050505',
} as const

// ── State設定 ────────────────────────────────────────────────
interface Cfg {
  ringSpeed:       [string, string, string, string]  // outer→inner 4層速度
  pulseDur:        string
  glowColor:       string
  glowStrong:      string
  particleOpa:     number
  ringOpa:         [number, number, number, number]
  innerBright:     boolean
  scannerOn:       boolean
  waveActive:      boolean
  connectingArc:   boolean
}

const CFGS: Record<string, Cfg> = {
  idle: {
    ringSpeed:     ['35s', '28s', '22s', '18s'],
    pulseDur:      '3.5s',
    glowColor:     'rgba(255,180,0,0.15)',
    glowStrong:    'rgba(255,200,0,0.08)',
    particleOpa:   0.35,
    ringOpa:       [0.35, 0.45, 0.50, 0.60],
    innerBright:   false,
    scannerOn:     false,
    waveActive:    false,
    connectingArc: false,
  },
  listening: {
    ringSpeed:     ['12s', '9s', '6s', '4s'],
    pulseDur:      '1.0s',
    glowColor:     'rgba(255,190,0,0.40)',
    glowStrong:    'rgba(255,210,0,0.25)',
    particleOpa:   0.85,
    ringOpa:       [0.65, 0.75, 0.85, 1.0],
    innerBright:   true,
    scannerOn:     false,
    waveActive:    true,
    connectingArc: false,
  },
  processing: {
    ringSpeed:     ['8s', '6s', '4s', '2.5s'],
    pulseDur:      '0.6s',
    glowColor:     'rgba(255,200,0,0.35)',
    glowStrong:    'rgba(255,215,0,0.20)',
    particleOpa:   1.0,
    ringOpa:       [0.70, 0.80, 0.90, 1.0],
    innerBright:   true,
    scannerOn:     true,
    waveActive:    false,
    connectingArc: false,
  },
  working: {
    ringSpeed:     ['6s', '5s', '3s', '2s'],
    pulseDur:      '0.5s',
    glowColor:     'rgba(255,200,0,0.38)',
    glowStrong:    'rgba(255,210,0,0.22)',
    particleOpa:   1.0,
    ringOpa:       [0.70, 0.80, 0.90, 1.0],
    innerBright:   true,
    scannerOn:     true,
    waveActive:    false,
    connectingArc: false,
  },
  speaking: {
    ringSpeed:     ['10s', '8s', '5s', '3.5s'],
    pulseDur:      '0.9s',
    glowColor:     'rgba(255,200,0,0.50)',
    glowStrong:    'rgba(255,220,0,0.32)',
    particleOpa:   0.95,
    ringOpa:       [0.70, 0.85, 0.95, 1.0],
    innerBright:   true,
    scannerOn:     false,
    waveActive:    true,
    connectingArc: false,
  },
  error: {
    ringSpeed:     ['20s', '16s', '12s', '8s'],
    pulseDur:      '0.7s',
    glowColor:     'rgba(255,50,20,0.30)',
    glowStrong:    'rgba(255,60,30,0.18)',
    particleOpa:   0.50,
    ringOpa:       [0.45, 0.55, 0.65, 0.80],
    innerBright:   false,
    scannerOn:     false,
    waveActive:    false,
    connectingArc: false,
  },
  connecting: {
    ringSpeed:     ['15s', '12s', '8s', '5s'],
    pulseDur:      '1.4s',
    glowColor:     'rgba(255,170,0,0.25)',
    glowStrong:    'rgba(255,185,0,0.12)',
    particleOpa:   0.50,
    ringOpa:       [0.40, 0.50, 0.60, 0.70],
    innerBright:   false,
    scannerOn:     false,
    waveActive:    false,
    connectingArc: true,
  },
}

// ── テキスト ─────────────────────────────────────────────────
const LABELS: Record<string, { main: string; sub: string }> = {
  idle:       { main: 'JARVIS',   sub: 'STANDBY' },
  listening:  { main: 'LISTEN',   sub: '聞いています' },
  processing: { main: 'THINK',    sub: '考えています' },
  working:    { main: 'PROCESS',  sub: '処理中' },
  speaking:   { main: 'SPEAK',    sub: '応答しています' },
  error:      { main: 'ERROR',    sub: 'エラー' },
  connecting: { main: 'LINK',     sub: '接続中...' },
}

// ── パーティクル配置（固定seed）────────────────────────────
const DOTS = [
  {a:8,  rr:0.96}, {a:28, rr:0.93}, {a:55, rr:0.97},
  {a:80, rr:0.94}, {a:108,rr:0.96}, {a:132,rr:0.92},
  {a:158,rr:0.97}, {a:178,rr:0.94}, {a:205,rr:0.96},
  {a:228,rr:0.93}, {a:255,rr:0.97}, {a:278,rr:0.94},
  {a:305,rr:0.96}, {a:328,rr:0.92}, {a:352,rr:0.97},
  {a:42, rr:0.98}, {a:142,rr:0.98}, {a:242,rr:0.98},
]

// ── ウェーブバー ──────────────────────────────────────────────
const WAVE_H = [0.35, 0.60, 0.85, 1.0, 0.70, 1.0, 0.85, 0.55, 0.35]

export function HikaruCore({ mode, size = 280, isConnecting = false }: HikaruCoreProps) {
  const cfgKey    = isConnecting ? 'connecting' : mode
  const cfg       = CFGS[cfgKey] ?? CFGS.idle
  const label     = LABELS[cfgKey] ?? LABELS.idle
  const isErr     = mode === 'error' && !isConnecting
  const r         = size / 2

  const prefersReduced = React.useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )
  const pr = prefersReduced.current

  const spd = (s: string) => pr ? `${parseFloat(s) * 4}s` : s
  const [sA, sB, sC, sD] = cfg.ringSpeed
  const [oA, oB, oC, oD] = cfg.ringOpa

  // リング色
  const rC    = isErr ? C.error  : C.gold
  const rCB   = isErr ? C.error  : C.goldBright
  const rCSoft = isErr ? C.errorDim : C.goldSoft

  // テキスト色
  const tMain = isErr ? C.error : C.goldBright
  const tSub  = isErr ? C.error : C.goldSoft

  // グロー
  const glowBox  = isErr
    ? `0 0 ${size*0.12}px rgba(255,50,20,.55), 0 0 ${size*0.22}px rgba(255,30,10,.30), 0 0 ${size*0.35}px rgba(200,20,0,.12)`
    : isConnecting
    ? `0 0 ${size*0.10}px rgba(255,180,0,.40), 0 0 ${size*0.20}px rgba(255,160,0,.22), 0 0 ${size*0.32}px rgba(255,140,0,.10)`
    : `0 0 ${size*0.12}px rgba(255,200,0,.${cfg.innerBright?'60':'30'}), 0 0 ${size*0.24}px rgba(255,180,0,.${cfg.innerBright?'35':'18'}), 0 0 ${size*0.40}px rgba(255,150,0,.${cfg.innerBright?'18':'08'})`

  // tick mark 24本
  const TICKS = Array.from({length:36},(_,i)=>({ a:(i*10*Math.PI)/180, major: i%6===0 }))

  // 主テキスト・サブテキストのフォントサイズ
  const fMain = Math.max(10, size * 0.082)
  const fSub  = Math.max(7,  size * 0.042)

  // waveform for SVG (listening / speaking)
  const waveX0 = r - size * 0.18
  const waveBarW = (size * 0.36) / (WAVE_H.length * 2 - 1)
  const waveMaxH = size * 0.06

  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}
      role="img" aria-label={`JARVIS - ${cfgKey}`}>

      {/* ── keyframes ── */}
      <style>{`
        @keyframes hk-cw   { to { transform:rotate(360deg); } }
        @keyframes hk-ccw  { to { transform:rotate(-360deg); } }
        @keyframes hk-pulse{ 0%,100%{opacity:.55;transform:scale(.97)} 50%{opacity:1;transform:scale(1.03)} }
        @keyframes hk-glow { 0%,100%{opacity:.65} 50%{opacity:1} }
        @keyframes hk-dot  { 0%,100%{opacity:.1;transform:scale(.5)} 50%{opacity:1;transform:scale(1.1)} }
        @keyframes hk-scan { to { transform:rotate(360deg); } }
        @keyframes hk-arc  { 0%,100%{opacity:.25;stroke-dashoffset:0} 50%{opacity:.9;stroke-dashoffset:-20} }
        @keyframes hk-wave { 0%{transform:scaleY(.2)} 100%{transform:scaleY(1)} }
        @keyframes hk-err  { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes hk-tri  { 0%,100%{opacity:.4} 50%{opacity:1} }
        @media(prefers-reduced-motion:reduce){
          [class*="hk-"]{animation-duration:40s!important}
        }
      `}</style>

      {/* ── 背景radial ambient glow ── */}
      <div style={{
        position:'absolute', inset:'-30%', borderRadius:'50%',
        background: `radial-gradient(ellipse at center, ${cfg.glowColor} 0%, ${cfg.glowStrong} 35%, transparent 70%)`,
        pointerEvents:'none',
        animation:`hk-glow ${cfg.pulseDur} ease-in-out infinite`,
      }}/>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:'visible', position:'relative', zIndex:1}}>
        <defs>
          {/* inner core gradient */}
          <radialGradient id={`hk-core-${size}`} cx="50%" cy="45%" r="55%">
            <stop offset="0%"   stopColor={isErr ? '#1a0000' : '#0a0800'} />
            <stop offset="60%"  stopColor={isErr ? '#0d0000' : '#060500'} />
            <stop offset="100%" stopColor="#020201" />
          </radialGradient>
          {/* inner glow ring gradient */}
          <radialGradient id={`hk-glow-${size}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={rCB} stopOpacity={cfg.innerBright ? 0.30 : 0.10} />
            <stop offset="100%" stopColor={rC}  stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ── Layer 1: 最外周 radar thin ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-cw ${spd(sA)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.970} fill="none" stroke={rCSoft} strokeWidth="0.4" strokeDasharray="2 8" opacity={oA*0.6}/>
        </g>

        {/* ── Layer 2: tick marks ring（静的）── */}
        {TICKS.map(({a, major},i)=>{
          const ro=r*0.955, ri=r*(major?0.930:0.945)
          return <line key={i}
            x1={r+Math.cos(a)*ri} y1={r+Math.sin(a)*ri}
            x2={r+Math.cos(a)*ro} y2={r+Math.sin(a)*ro}
            stroke={rC} strokeWidth={major?1.2:0.5} opacity={major?oA*0.55:oA*0.22}/>
        })}

        {/* ── Layer 3: segment outer ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-ccw ${spd(sA)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.910} fill="none" stroke={rC} strokeWidth="0.8" strokeDasharray="22 6 5 6" opacity={oA}/>
        </g>

        {/* ── Layer 4: broken arc ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-cw ${spd(sB)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.865} fill="none" stroke={rCB} strokeWidth="1.2" strokeDasharray="55 12 8 12 30 12" opacity={oB}/>
          {/* triangle marker */}
          <polygon points={`${r},${r*0.12} ${r-3.5},${r*0.148} ${r+3.5},${r*0.148}`} fill={rCB} opacity={oB}/>
        </g>

        {/* ── Layer 5: medium segmented ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-ccw ${spd(sB)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.820} fill="none" stroke={rC} strokeWidth="1.5" strokeDasharray="18 5 6 5" opacity={oB}/>
        </g>

        {/* ── CONNECTING: dashed orbit arc ── */}
        {cfg.connectingArc && (
          <circle cx={r} cy={r} r={r*0.76} fill="none" stroke={C.amber}
            strokeWidth="1.5" strokeDasharray="30 15" opacity="0.7"
            style={{animation:`hk-arc 1.4s ease-in-out infinite`, transformOrigin:`${r}px ${r}px`}}/>
        )}

        {/* ── Layer 6: inner segmented ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-cw ${spd(sC)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.758} fill="none" stroke={rCB} strokeWidth="1.8" strokeDasharray="40 8 10 8 20 8" opacity={oC}/>
        </g>

        {/* ── Layer 7: counter ring ── */}
        <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-ccw ${spd(sC)} linear infinite`}}>
          <circle cx={r} cy={r} r={r*0.710} fill="none" stroke={rC} strokeWidth="1.0" strokeDasharray="12 4" opacity={oC*0.7}/>
        </g>

        {/* ── Layer 8: bright inner solid ring ── */}
        <circle cx={r} cy={r} r={r*0.660} fill="none"
          stroke={cfg.innerBright ? rCB : rCSoft}
          strokeWidth={cfg.innerBright ? 3.0 : 1.5}
          opacity={oD}
          style={{
            filter: cfg.innerBright ? `drop-shadow(0 0 ${size*0.018}px ${rCB}) drop-shadow(0 0 ${size*0.008}px ${C.goldBright})` : 'none',
            animation:`hk-glow ${cfg.pulseDur} ease-in-out infinite`,
          }}/>

        {/* ── Layer 9: glow ring (soft) ── */}
        <circle cx={r} cy={r} r={r*0.610} fill="none"
          stroke={isErr ? C.error : rCB}
          strokeWidth={cfg.innerBright ? 6 : 3}
          opacity={cfg.innerBright ? 0.18 : 0.07}
          style={{animation:`hk-pulse ${cfg.pulseDur} ease-in-out infinite`}}/>

        {/* ── Layer 10: HUD radial lines (6本) ── */}
        {[0,60,120,180,240,300].map((deg,i)=>{
          const rad=(deg*Math.PI)/180
          return <line key={i}
            x1={r+Math.cos(rad)*r*0.60} y1={r+Math.sin(rad)*r*0.60}
            x2={r+Math.cos(rad)*r*0.42} y2={r+Math.sin(rad)*r*0.42}
            stroke={rC} strokeWidth="0.5" opacity={oC*0.40}/>
        })}

        {/* ── Core background ── */}
        <circle cx={r} cy={r} r={r*0.390} fill={`url(#hk-core-${size})`}/>

        {/* ── Core inner glow fill ── */}
        <circle cx={r} cy={r} r={r*0.370} fill={`url(#hk-glow-${size})`}
          style={{animation:`hk-pulse ${cfg.pulseDur} ease-in-out infinite`}}/>

        {/* ── THINKING / WORKING: Scanner line ── */}
        {cfg.scannerOn && !pr && (
          <g style={{transformOrigin:`${r}px ${r}px`, animation:`hk-scan 1.8s linear infinite`}}>
            <line x1={r} y1={r} x2={r} y2={r*0.28} stroke={rCB} strokeWidth="0.7" opacity="0.65"/>
            <circle cx={r} cy={r*0.30} r="2.2" fill={rCB} opacity="0.9"/>
          </g>
        )}

        {/* ── Particles ── */}
        {DOTS.map(({a,rr},i)=>{
          const rad=(a*Math.PI)/180
          const delay=`${(i*0.25)%2.8}s`
          return <circle key={i}
            cx={r+Math.cos(rad)*r*rr} cy={r+Math.sin(rad)*r*rr}
            r={i%3===0 ? 2.2 : 1.4}
            fill={rC}
            style={{
              animation:`hk-dot ${cfg.pulseDur} ease-in-out ${delay} infinite`,
              opacity: cfg.particleOpa,
            }}/>
        })}

        {/* ── ERROR triangle icon ── */}
        {isErr && (
          <text x={r} y={r+size*0.10} textAnchor="middle" fill={C.error}
            fontSize={size*0.075} fontFamily="monospace"
            style={{animation:`hk-tri ${cfg.pulseDur} ease-in-out infinite`, userSelect:'none'}}>
            ⚠
          </text>
        )}

        {/* ── Waveform (LISTENING / SPEAKING) ── */}
        {cfg.waveActive && !pr && WAVE_H.map((h,i)=>{
          const x = waveX0 + i * waveBarW * 2
          const barH = h * waveMaxH
          const y1 = r + barH / 2
          return (
            <rect key={i}
              x={x} y={y1 - barH}
              width={Math.max(1.5, waveBarW - 1)} height={barH}
              rx="1" fill={rCB} opacity="0.85"
              style={{
                transformOrigin:`${x}px ${y1}px`,
                animation:`hk-wave ${0.4 + i * 0.08}s ease-in-out ${i * 0.06}s infinite alternate`,
              }}/>
          )
        })}

        {/* ── Center text: main label ── */}
        <text x={r} y={r - (isErr ? fMain * 1.2 : fSub * 0.5)}
          textAnchor="middle" dominantBaseline="middle"
          fill={tMain} fontSize={fMain}
          fontWeight="900" letterSpacing="0.14em"
          fontFamily="'Courier New',Courier,monospace"
          opacity="0.98"
          style={{
            filter: cfg.innerBright
              ? `drop-shadow(0 0 ${fMain*0.4}px ${tMain})`
              : 'none',
            userSelect:'none',
            animation: isErr ? `hk-err ${cfg.pulseDur} ease-in-out infinite` : undefined,
          }}>
          {label.main}
        </text>

        {/* ── Center text: sub label ── */}
        {!isErr && (
          <text x={r} y={r + fMain * 0.72}
            textAnchor="middle" dominantBaseline="middle"
            fill={tSub} fontSize={fSub}
            letterSpacing="0.10em"
            fontFamily="'Courier New',Courier,monospace"
            opacity="0.65"
            style={{userSelect:'none'}}>
            {label.sub}
          </text>
        )}

        {/* ── IDLE dots below sub ── */}
        {cfgKey === 'idle' && (
          <text x={r} y={r + fMain * 0.72 + fSub * 1.5}
            textAnchor="middle" fill={C.goldDim} fontSize={fSub * 0.8}
            letterSpacing="0.20em" fontFamily="monospace" opacity="0.40"
            style={{userSelect:'none'}}>
            · · · · ·
          </text>
        )}
      </svg>

      {/* ── CSS box-shadow glow overlay ── */}
      <div style={{
        position:'absolute', inset:0, borderRadius:'50%',
        boxShadow: glowBox,
        pointerEvents:'none', zIndex:2,
        animation:`hk-glow ${cfg.pulseDur} ease-in-out infinite`,
      }}/>
    </div>
  )
}
