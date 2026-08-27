'use client'

import * as React from 'react'
import { useRouter }       from 'next/navigation'
import { Settings, Volume2, Home, Bell, Calendar, Zap, X, Link2, Mic, Bot } from 'lucide-react'
import { HikaruCore }      from '@/components/voice/HikaruCore'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { browserTTS }      from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings, VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HIKARU AI Assistant — Central JARVIS Neon HUD
// 中央JARVIS HUDが主役。マイクボタンなし。JARVISタップで起動/停止。
// Voice Logic は一切変更しない。
// ============================================================

const BG     = '#020202'
const GD     = '#FFD700'
const GB     = '#FFE878'
const GDim   = 'rgba(255,215,0,0.45)'
const GBdr   = 'rgba(255,215,0,0.22)'

// Status item definition
const STATUS_ITEMS = [
  { key:'idle',       label:'STANDBY',    sub:'停止中',      color:'#C89010', dot:'#AA7800' },
  { key:'connecting', label:'CONNECTING', sub:'接続中',      color:'#00AFFF', dot:'#00AFFF' },
  { key:'listening',  label:'LISTENING',  sub:'聞いています', color:'#FFD700', dot:'#FFD700' },
  { key:'processing', label:'THINKING',   sub:'考えています', color:'#FFB800', dot:'#FFB800' },
  { key:'working',    label:'PROCESSING', sub:'処理中',      color:'#C030D8', dot:'#C030D8' },
  { key:'speaking',   label:'SPEAKING',   sub:'応答しています',color:'#00D860', dot:'#00D860' },
  { key:'error',      label:'ERROR',      sub:'接続エラー',   color:'#FF3030', dot:'#FF3030' },
] as const

type StatusKey = typeof STATUS_ITEMS[number]['key']

// ─── Wave bars ───────────────────────────────────────────────
function Wave({ active, h: mH = 18 }: { active: boolean; h?: number }) {
  const v = [.25,.48,.70,.92,1,.94,.74,.94,1,.80,.56,.30]
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:mH }}>
      <style>{`@keyframes jvw2{0%{transform:scaleY(.09)}100%{transform:scaleY(1)}}`}</style>
      {v.map((val,i) => (
        <div key={i} style={{
          width:3, borderRadius:2, height:`${val*mH}px`,
          background: active ? GB : GDim, opacity: active ? .88 : .22,
          animation: active ? `jvw2 ${.38+i*.07}s ease-in-out ${i*.055}s infinite alternate` : 'none',
          transformOrigin:'bottom',
        }}/>
      ))}
    </div>
  )
}

// ─── Clock ───────────────────────────────────────────────────
function Clock() {
  const [t,setT] = React.useState('')
  React.useEffect(() => {
    const f = () => setT(new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    f(); const id=setInterval(f,1000); return()=>clearInterval(id)
  },[])
  return <>{t}</>
}

// ─── Voice Settings Panel ────────────────────────────────────
function SettingsPanel({settings,onClose,onSave}:{settings:VoiceSettings;onClose:()=>void;onSave:(s:VoiceSettings)=>void}) {
  const [l,setL]=React.useState<VoiceSettings>(settings)
  const [vs,setVs]=React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(()=>{
    const f=()=>{if(typeof window==='undefined')return;setVs(window.speechSynthesis.getVoices())}
    f(); window.speechSynthesis.addEventListener?.('voiceschanged',f)
    return()=>window.speechSynthesis.removeEventListener?.('voiceschanged',f)
  },[])
  const all = vs.filter(v=>v.lang.startsWith('ja'))
  return (
    <div style={{position:'absolute',inset:0,zIndex:30,background:'#040404',border:`1px solid ${GBdr}`,
      display:'flex',flexDirection:'column',padding:20,overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
        <span style={{color:GB,fontSize:12,fontWeight:700,letterSpacing:'.18em',fontFamily:'monospace'}}>VOICE SETTINGS</span>
        <button onClick={onClose} style={{color:GDim,background:'none',border:'none',cursor:'pointer'}}><X style={{width:15,height:15}}/></button>
      </div>
      <label style={{color:GDim,fontSize:9,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:5}}>音声</label>
      <select value={l.voiceURI} onChange={e=>setL(p=>({...p,voiceURI:e.target.value}))}
        style={{background:'rgba(255,200,0,.06)',border:`1px solid ${GBdr}`,color:GB,borderRadius:8,padding:'6px 8px',fontSize:12,marginBottom:14}}>
        <option value="">自動</option>
        {all.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
      </select>
      {(['rate','pitch','volume'] as const).map(k=>(
        <div key={k} style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:GDim,fontSize:9,letterSpacing:'.2em',fontFamily:'monospace'}}>{{rate:'速度',pitch:'ピッチ',volume:'音量'}[k]}</span>
            <span style={{color:GB,fontSize:9,fontFamily:'monospace'}}>{l[k].toFixed(1)}</span>
          </div>
          <input type="range" min={k==='pitch'?0:k==='volume'?0:.5} max={k==='volume'?1:2} step={.1}
            value={l[k]} onChange={e=>setL(p=>({...p,[k]:parseFloat(e.target.value)}))}
            style={{width:'100%',accentColor:GD}}/>
        </div>
      ))}
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button onClick={()=>browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。`,undefined,l)}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GBdr}`,background:'none',color:GB,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <Volume2 style={{width:13,height:13}}/>試聴
        </button>
        <button onClick={()=>{onSave(l);onClose()}}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GD}`,background:'rgba(255,215,0,.12)',color:GB,cursor:'pointer',fontSize:12,fontWeight:700}}>
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Responsive HUD ──────────────────────────────────────────
function JarvisHUD({ mode, isConnecting, onClick, isSession }: {
  mode: VoiceMode; isConnecting: boolean; onClick: ()=>void; isSession: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [sz, setSz] = React.useState(360)
  const [hov, setHov] = React.useState(false)
  React.useEffect(()=>{
    if(!ref.current) return
    const ro = new ResizeObserver(([e])=>{
      // HikaruCore W = H = size*1.04, so size = min(w,h)/1.04
      const cw=e.contentRect.width, ch=e.contentRect.height
      const s = Math.floor(Math.min(cw, ch) / 1.04)
      setSz(Math.min(Math.max(s, 200), 700))
    })
    ro.observe(ref.current)
    return()=>ro.disconnect()
  },[])
  return (
    <div ref={ref}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0,overflow:'hidden'}}>
      <HikaruCore mode={mode} size={sz} isConnecting={isConnecting}
        onClick={onClick} isHovered={hov}/>
    </div>
  )
}

// ─── Right Panel Status Row ───────────────────────────────────
function SRow({ item, active }: { item: typeof STATUS_ITEMS[number]; active: boolean }) {
  return (
    <div style={{display:'flex',alignItems:'flex-start',gap:10,padding:'6px 0',
      borderBottom:'1px solid rgba(255,215,0,0.07)'}}>
      <div style={{
        width:9,height:9,borderRadius:'50%',flexShrink:0,marginTop:3,
        background:item.dot,
        boxShadow:active?`0 0 8px ${item.dot},0 0 18px ${item.dot}55`:'none',
        opacity:active?1:.22,
        transition:'all .35s',
      }}/>
      <div>
        <div style={{
          fontSize:11,fontWeight:active?700:400,
          color:active?item.color:'rgba(255,255,255,.32)',
          fontFamily:'monospace',letterSpacing:'.10em',
          textShadow:active?`0 0 8px ${item.color}`:undefined,
          transition:'all .35s',
        }}>
          {item.label}
        </div>
        <div style={{fontSize:10,color:active?'rgba(255,255,255,.68)':'rgba(255,255,255,.20)',marginTop:1}}>
          {item.sub}
        </div>
      </div>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────
function AssistantContent() {
  const router=useRouter()
  const [showSettings,setShowSettings]=React.useState(false)

  const {
    mode, errorMessage,
    isSession, isStandby, isSpeechSupported,
    startSession, stopSession, handleUtterance,
    voiceSettings, setVoiceSettings,
    voiceEngineMode, disconnectRealtime,
  }=useSystemJarvis()

  const isErr    = mode==='error'
  const isActive = mode==='listening'
  const isProc   = mode==='processing'||mode==='working'
  const isSpeak  = mode==='speaking'
  const isConn   = voiceEngineMode==='realtime-connecting'
  const isReady  = voiceEngineMode==='realtime'
  const cfgKey   = isConn?'connecting':mode as StatusKey

  const cur = STATUS_ITEMS.find(s=>s.key===cfgKey) ?? STATUS_ITEMS[0]

  const toggleSession = () => isSession ? stopSession() : startSession()

  const QUICK=[
    {label:'ホームに戻る', utt:'ホームに戻って', Icon:Home},
    {label:'通知を確認',   utt:'通知を確認して', Icon:Bell},
    {label:'スケジュール', utt:'スケジュールを見せて', Icon:Calendar},
    {label:'AIに質問',    utt:'何でも聞いて',   Icon:Zap},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'calc(100dvh - var(--header-height))',background:BG,position:'relative',overflow:'hidden'}}>
      <style>{`
        .jp-right{
          display:flex;flex-direction:column;
          width:240px;flex-shrink:0;
          border-left:1px solid ${GBdr};
          background:#030303;overflow-y:auto;
        }
        @media(max-width:880px){.jp-right{display:none!important}}
        @keyframes jconn{0%,100%{opacity:.3}50%{opacity:1}}
        .jqbtn:hover{background:rgba(255,215,0,0.10)!important}
      `}</style>

      {showSettings && <SettingsPanel settings={voiceSettings} onClose={()=>setShowSettings(false)} onSave={setVoiceSettings}/>}

      {/* ── Header ── */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',
        padding:'8px 18px',flexShrink:0,
        borderBottom:`1px solid ${GBdr}`,background:'rgba(0,0,0,.88)',zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:7,height:7,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 7px #4ade80'}}/>
          <span style={{color:GDim,fontSize:9,letterSpacing:'.22em',fontFamily:'monospace'}}>AI ENGINE</span>
          <span style={{color:GDim,fontSize:9,fontFamily:'monospace',opacity:.5}}><Clock/></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isSession && (
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 12px',borderRadius:20,
              background:'rgba(255,215,0,.14)',border:`1px solid ${GD}`,
              boxShadow:`0 0 12px rgba(255,215,0,.32)`}}>
              <div style={{width:6,height:6,borderRadius:'50%',
                background:isStandby?GDim:'#4ade80',
                animation:'jconn 1.2s ease-in-out infinite'}}/>
              <span style={{color:GB,fontSize:9,fontWeight:700,letterSpacing:'.16em',fontFamily:'monospace'}}>
                {isStandby?'STANDBY':'ACTIVE'}
              </span>
            </div>
          )}
          <Wave active={isActive||isSpeak}/>
          <button onClick={()=>setShowSettings(p=>!p)}
            style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}}
            aria-label="設定"><Settings style={{width:15,height:15}}/></button>
          <button onClick={()=>router.push('/home')}
            style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}}
            aria-label="閉じる"><X style={{width:15,height:15}}/></button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Center: JARVIS HUD ── */}
        <main style={{display:'flex',flex:1,flexDirection:'column',overflow:'hidden',padding:'4px 0 4px'}}>

          {/* HUD — fills available space, click = toggle */}
          <JarvisHUD mode={mode} isConnecting={isConn} onClick={toggleSession} isSession={isSession}/>

          {/* Tap label — 1行 */}
          <div style={{textAlign:'center',flexShrink:0,padding:'3px 0 2px'}}>
            <span style={{color:isSession?GB:GDim,fontSize:10,fontFamily:'monospace',letterSpacing:'.12em'}}>
              {isSession
                ?(isStandby?'スタンバイ中 — 話しかけてください':'JARVISをタップして起動 / 停止')
                :'JARVISをタップして起動 / 停止'}
            </span>
            {isErr && <span style={{color:'#FF5555',fontSize:9,fontFamily:'monospace',marginLeft:8}}>{errorMessage||'接続エラー'}</span>}
          </div>

          {/* Bottom status bar — 単一行 (PHASE 21) */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:18,
            padding:'4px 16px 3px',flexShrink:0}}>
            {/* 接続状態 */}
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:5,height:5,borderRadius:'50%',
                background:isReady?'#4ade80':isConn?'#FFB800':isErr?'#FF4444':GDim,
                boxShadow:isReady?'0 0 5px #4ade80':isConn?'0 0 5px #FFB800':'none',
                animation:isConn?'jconn 1.2s ease-in-out infinite':undefined}}/>
              <span style={{color:GDim,fontSize:9,fontFamily:'monospace'}}>
                {isReady?'READY':isConn?'CONNECTING':isErr?'ERROR':'STANDBY'}
              </span>
            </div>
            {/* sep */}
            <span style={{color:GBdr,fontSize:9}}>|</span>
            {/* マイク */}
            <div style={{display:'flex',alignItems:'center',gap:4}}>
              <Mic style={{color:GDim,width:11,height:11}}/>
              <span style={{color:isSession?GD:GDim,fontSize:9,fontWeight:isSession?700:400,fontFamily:'monospace'}}>
                MIC {isSession?'ON':'OFF'}
              </span>
              <div style={{width:5,height:5,borderRadius:'50%',background:isSession?GD:'#555',boxShadow:isSession?`0 0 5px ${GD}`:'none'}}/>
            </div>
            {/* Wave */}
            <Wave active={isActive||isSpeak} h={14}/>
            {/* AIモデル */}
            <span style={{color:GB,fontSize:9,fontWeight:700,fontFamily:'monospace',letterSpacing:'.08em'}}>HIKARU AI</span>
          </div>
        </main>

        {/* ── Right Panel ── */}
        <aside className="jp-right">
          <div style={{display:'flex',flexDirection:'column',gap:0,padding:'16px 16px 12px',flex:1}}>

            {/* STATUS */}
            <div style={{marginBottom:16}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:10}}>
                STATUS（ステータス）
              </div>
              {STATUS_ITEMS.map(item=>(
                <SRow key={item.key} item={item} active={cfgKey===item.key}/>
              ))}
            </div>

            {/* MODE */}
            <div style={{marginBottom:16,padding:'12px 14px',borderRadius:12,
              border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)'}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:10}}>
                MODE（モード）
              </div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                <span style={{
                  fontSize:17,fontWeight:800,color:cur.color,fontFamily:'monospace',letterSpacing:'.12em',
                  textShadow:isSession?`0 0 12px ${cur.color}`:undefined,
                  transition:'all .35s',
                }}>
                  {cur.label}
                </span>
                <Wave active={isActive||isSpeak} h={18}/>
              </div>
              <div style={{color:'rgba(255,255,255,.50)',fontSize:11}}>{cur.sub}</div>
              {voiceEngineMode==='realtime'&&(
                <button onClick={disconnectRealtime}
                  style={{marginTop:10,fontSize:9,color:GDim,background:'none',
                    border:`1px solid ${GBdr}`,cursor:'pointer',borderRadius:6,padding:'3px 8px',fontFamily:'monospace'}}>
                  切断
                </button>
              )}
            </div>

            {/* QUICK ACTION */}
            <div style={{marginBottom:16}}>
              <div style={{color:GDim,fontSize:9,fontWeight:700,letterSpacing:'.22em',fontFamily:'monospace',marginBottom:10}}>
                QUICK ACTION（クイックアクション）
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {QUICK.map(({label,utt,Icon})=>(
                  <button key={label} onClick={()=>handleUtterance(utt)}
                    disabled={isActive||isProc}
                    className="jqbtn"
                    style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      gap:6,padding:'12px 6px',borderRadius:12,
                      border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)',
                      color:'rgba(255,255,255,.65)',cursor:'pointer',fontSize:10,
                      opacity:isActive||isProc?.4:1,transition:'background .18s'}}>
                    <Icon style={{color:GDim,width:20,height:20}}/>
                    <span style={{lineHeight:1.3,textAlign:'center'}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <button onClick={()=>setShowSettings(true)}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 0',
                borderRadius:10,border:`1px solid ${GBdr}`,background:'rgba(255,215,0,.04)',
                color:GDim,cursor:'pointer',fontSize:10,fontFamily:'monospace',
                letterSpacing:'.14em',marginTop:'auto',transition:'background .18s'}}>
              <Settings style={{width:13,height:13}}/>音声設定
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <React.Suspense fallback={
      <div style={{display:'flex',height:'100dvh',alignItems:'center',justifyContent:'center',background:BG}}>
        <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${GD}`,borderTopColor:'transparent',animation:'sp 1s linear infinite'}}/>
        <style>{`@keyframes sp{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AssistantContent/>
    </React.Suspense>
  )
}
