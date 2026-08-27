'use client'

import * as React from 'react'
import { useRouter }       from 'next/navigation'
import { Mic, X, Settings, Volume2, Radio, Home, Bell, Calendar, Zap } from 'lucide-react'
import { HikaruCore }      from '@/components/voice/HikaruCore'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { browserTTS }      from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings, VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HIKARU AI Assistant — 3D Holographic JARVIS HUD
// useSystemJarvis() でVoice stateを取得しVisualへマッピングするのみ。
// Voice Engine / Logic / API は一切変更しない。
// ============================================================

const GOLD = '#FFD700'
const GOLD_B = '#FFE878'
const GOLD_D = 'rgba(200,144,16,0.50)'
const GOLD_DIM = 'rgba(200,144,16,0.22)'
const GOLD_BDR = 'rgba(200,144,16,0.18)'
const BG = '#020202'

// State-based primary color (for glow/indicators)
const STATE_COLOR: Record<string, string> = {
  idle:'#C89010', connecting:'#00AFFF', listening:'#FFD700',
  processing:'#FFB800', working:'#C030D8', speaking:'#00E060', error:'#FF3030',
}

// ─── Waveform ────────────────────────────────────────────────
function Wave({ active }: { active: boolean }) {
  const h = [.28,.50,.72,.92,1,.95,.78,.96,1,.82]
  return (
    <div className="flex items-end gap-[2px]" style={{ height:18 }}>
      <style>{`@keyframes jw{0%{transform:scaleY(.12)}100%{transform:scaleY(1)}}`}</style>
      {h.map((v,i) => (
        <div key={i} style={{
          width:3, height:`${v*18}px`, borderRadius:2,
          background: active ? GOLD_B : GOLD_D,
          opacity: active ? .88 : .25,
          animation: active ? `jw ${.40+i*.07}s ease-in-out ${i*.055}s infinite alternate` : 'none',
          transformOrigin:'bottom',
        }}/>
      ))}
    </div>
  )
}

// ─── Live clock ──────────────────────────────────────────────
function Clock() {
  const [t,setT] = React.useState('')
  React.useEffect(()=>{
    const tick=()=>setT(new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    tick(); const id=setInterval(tick,1000); return()=>clearInterval(id)
  },[])
  return <>{t}</>
}

// ─── Voice Settings Panel ────────────────────────────────────
function VoiceSettingsPanel({ settings, onClose, onSave }:{settings:VoiceSettings;onClose:()=>void;onSave:(s:VoiceSettings)=>void}) {
  const [local,setLocal] = React.useState<VoiceSettings>(settings)
  const [voices,setVoices] = React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(()=>{
    const load=()=>{if(typeof window==='undefined')return;setVoices(window.speechSynthesis.getVoices())}
    load();window.speechSynthesis.addEventListener?.('voiceschanged',load)
    return()=>window.speechSynthesis.removeEventListener?.('voiceschanged',load)
  },[])
  const all = voices.filter(v=>v.lang.startsWith('ja')).length>0 ? voices.filter(v=>v.lang.startsWith('ja')) : voices
  return (
    <div style={{position:'absolute',inset:0,zIndex:30,display:'flex',flexDirection:'column',padding:20,overflowY:'auto',background:'#040404',border:`1px solid ${GOLD_BDR}`}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
        <span style={{color:GOLD_B,fontSize:11,fontWeight:700,letterSpacing:'.18em',fontFamily:'monospace'}}>VOICE SETTINGS</span>
        <button onClick={onClose} style={{color:GOLD_D,background:'none',border:'none',cursor:'pointer'}}><X style={{width:15,height:15}}/></button>
      </div>
      <label style={{color:GOLD_D,fontSize:8,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:6}}>音声</label>
      <select value={local.voiceURI} onChange={e=>setLocal(p=>({...p,voiceURI:e.target.value}))}
        style={{background:'rgba(255,200,0,.06)',border:`1px solid ${GOLD_BDR}`,color:GOLD_B,borderRadius:8,padding:'6px 8px',fontSize:12,marginBottom:14}}>
        <option value="">自動</option>
        {all.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
      </select>
      {(['rate','pitch','volume'] as const).map(k=>(
        <div key={k} style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',color:GOLD_D,fontSize:8,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:4}}>
            <span>{{rate:'速度',pitch:'ピッチ',volume:'音量'}[k]}</span>
            <span style={{color:GOLD_B}}>{local[k].toFixed(1)}</span>
          </div>
          <input type="range" min={k==='pitch'?0:k==='volume'?0:.5} max={k==='volume'?1:2} step={.1}
            value={local[k]} onChange={e=>setLocal(p=>({...p,[k]:parseFloat(e.target.value)}))}
            style={{width:'100%',accentColor:GOLD}}/>
        </div>
      ))}
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button onClick={()=>browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。`,undefined,local)}
          style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 0',borderRadius:10,border:`1px solid ${GOLD_BDR}`,background:'none',color:GOLD_B,cursor:'pointer',fontSize:12}}>
          <Volume2 style={{width:14,height:14}}/>試聴
        </button>
        <button onClick={()=>{onSave(local);onClose()}}
          style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'8px 0',borderRadius:10,border:`1px solid ${GOLD}`,background:'rgba(255,215,0,.12)',color:GOLD_B,cursor:'pointer',fontSize:12,fontWeight:700}}>
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Responsive HikaruCore ───────────────────────────────────
function JarvisHUD({ mode, isConnecting }: { mode: VoiceMode; isConnecting: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [sz,setSz] = React.useState(280)
  React.useEffect(()=>{
    if(!ref.current)return
    const ro=new ResizeObserver(([e])=>{
      // HikaruCore total height = size*1.82, width = size*1.05
      // We fit into a container — compute size from available width & height
      const cw=e.contentRect.width, ch=e.contentRect.height
      const byW = cw / 1.05
      const byH = ch / 1.82
      const s = Math.floor(Math.min(byW, byH, 460))
      setSz(Math.max(s, 180))
    })
    ro.observe(ref.current)
    return()=>ro.disconnect()
  },[])
  return (
    <div ref={ref} style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',minHeight:0}}>
      <HikaruCore mode={mode} size={sz} isConnecting={isConnecting}/>
    </div>
  )
}

// ─── Mic Button ──────────────────────────────────────────────
function MicBtn({ isOn, disabled, onClick }: { isOn:boolean; disabled:boolean; onClick:()=>void }) {
  const [hov,setHov] = React.useState(false)
  const col = isOn ? GOLD : '#886800'
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      aria-label={isOn?'JARVIS停止':'JARVIS起動'}
      style={{
        width:80,height:80,borderRadius:'50%',flexShrink:0,
        border:`2px solid ${col}`,cursor:disabled?'not-allowed':'pointer',
        background:isOn?'rgba(255,215,0,.14)':'rgba(180,120,0,.06)',
        boxShadow:isOn
          ?`0 0 16px rgba(255,215,0,.75),0 0 36px rgba(255,190,0,.40),0 0 65px rgba(255,160,0,.18)`
          :hov?`0 0 12px rgba(200,140,0,.45),0 0 28px rgba(180,120,0,.22)`
          :`0 0 6px rgba(160,110,0,.18)`,
        display:'flex',alignItems:'center',justifyContent:'center',
        opacity:disabled?.45:1,
        transform:hov&&!disabled?'scale(1.05)':'scale(1)',
        transition:'transform .18s,box-shadow .18s,background .18s',
      }}>
      {isOn
        ? <Radio style={{color:GOLD_B,width:34,height:34}}/>
        : <Mic   style={{color:GOLD,width:34,height:34}}/>}
    </button>
  )
}

// ─── Status row ───────────────────────────────────────────────
function StatRow({ dot, label, active }: { dot:string; label:string; active:boolean }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'4px 0'}}>
      <div style={{width:7,height:7,borderRadius:'50%',background:dot,flexShrink:0,boxShadow:active?`0 0 6px ${dot}`:'none',opacity:active?.95:.25}}/>
      <span style={{fontSize:9,fontFamily:'monospace',letterSpacing:'.14em',color:active?'rgba(255,255,255,.82)':'rgba(255,255,255,.28)',fontWeight:active?700:400}}>
        {label}
      </span>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────
function AssistantContent() {
  const router = useRouter()
  const [showSettings,setShowSettings] = React.useState(false)

  const {
    mode,errorMessage,messages,isSpeechSupported,
    isSession,isStandby,
    startSession,stopSession,handleUtterance,
    voiceSettings,setVoiceSettings,
    voiceEngineMode,disconnectRealtime,
  } = useSystemJarvis()

  const isErr      = mode === 'error'
  const isActive   = mode === 'listening'
  const isProc     = mode === 'processing' || mode === 'working'
  const isSpeak    = mode === 'speaking'
  const isConn     = voiceEngineMode === 'realtime-connecting'
  const engineReady = voiceEngineMode === 'realtime'

  const cfgKey = isConn ? 'connecting' : mode
  const stateColor = STATE_COLOR[cfgKey] ?? GOLD

  const toggle = () => isSession ? stopSession() : startSession()

  const QUICK = [
    {label:'ホームに戻る', utt:'ホームに戻って', Icon:Home},
    {label:'通知を確認',   utt:'通知を確認して', Icon:Bell},
    {label:'スケジュール', utt:'スケジュールを見せて', Icon:Calendar},
    {label:'AIに質問',    utt:'何でも聞いて',   Icon:Zap},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:BG,position:'relative',overflow:'hidden'}}>
      <style>{`
        .jp-right{display:flex;flex-direction:column;gap:10px;padding:14px;width:190px;flex-shrink:0;border-left:1px solid ${GOLD_BDR};overflow-y:auto}
        @media(max-width:840px){.jp-right{display:none}}
        @keyframes j-conn{0%,100%{opacity:.35}50%{opacity:1}}
      `}</style>

      {showSettings && (
        <VoiceSettingsPanel settings={voiceSettings} onClose={()=>setShowSettings(false)} onSave={setVoiceSettings}/>
      )}

      {/* ── Header ── */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 16px',flexShrink:0,borderBottom:`1px solid ${GOLD_BDR}`,background:'rgba(0,0,0,.80)'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}}/>
          <span style={{color:GOLD_D,fontSize:9,letterSpacing:'.22em',fontFamily:'monospace'}}>AI ENGINE</span>
          <span style={{color:GOLD_D,fontSize:9,fontFamily:'monospace',opacity:.55}}><Clock/></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isSession && (
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,
              background:'rgba(255,215,0,.12)',border:`1px solid ${GOLD}`,boxShadow:`0 0 10px rgba(255,215,0,.28)`}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:isStandby?GOLD_D:'#4ade80',animation:'j-conn 1.2s ease-in-out infinite'}}/>
              <span style={{color:GOLD_B,fontSize:9,fontWeight:700,letterSpacing:'.16em',fontFamily:'monospace'}}>
                {isStandby?'STANDBY':'ACTIVE'}
              </span>
            </div>
          )}
          <Wave active={isActive||isSpeak}/>
          <button onClick={()=>setShowSettings(p=>!p)} style={{color:GOLD_D,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}} aria-label="設定">
            <Settings style={{width:14,height:14}}/>
          </button>
          <button onClick={()=>router.push('/home')} style={{color:GOLD_D,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}} aria-label="閉じる">
            <X style={{width:14,height:14}}/>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Center: Holographic HUD ── */}
        <main style={{display:'flex',flex:1,flexDirection:'column',alignItems:'center',overflow:'hidden',padding:'8px 0 14px'}}>
          {/* HUD area - takes most of the space */}
          <JarvisHUD mode={mode} isConnecting={isConn}/>

          {/* Mic button */}
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10,marginTop:12,flexShrink:0}}>
            <MicBtn isOn={isSession} disabled={isProc} onClick={toggle}/>
            <span style={{color:isSession?GOLD_B:GOLD_D,fontSize:9,fontFamily:'monospace',letterSpacing:'.16em',textAlign:'center'}}>
              {isSession?(isStandby?'スタンバイ中 — 話しかけてください':'会話中 — 「終了」で停止'):'タップしてJARVISを起動'}
            </span>
            {isErr && (
              <span style={{color:'#FF5555',fontSize:9,fontFamily:'monospace'}}>{errorMessage||'接続エラー'}</span>
            )}
            {!isSpeechSupported && (
              <span style={{color:'rgba(255,100,60,.7)',fontSize:8}}>音声入力非対応ブラウザ</span>
            )}
          </div>

          {/* Bottom info bar */}
          <div style={{display:'flex',alignItems:'center',gap:16,marginTop:10,flexShrink:0,flexWrap:'wrap',justifyContent:'center'}}>
            {/* Connection */}
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'3px 10px',borderRadius:20,border:`1px solid ${GOLD_BDR}`,background:'rgba(0,0,0,.60)'}}>
              <div style={{width:5,height:5,borderRadius:'50%',
                background:isErr?'#FF3030':engineReady?'#4ade80':isConn?'#FFB800':GOLD_D,
                boxShadow:engineReady?'0 0 5px #4ade80':isConn?'0 0 5px #FFB800':'none',
                animation:isConn?'j-conn 1.2s ease-in-out infinite':undefined}}/>
              <span style={{color:GOLD_D,fontSize:8,letterSpacing:'.20em',fontFamily:'monospace'}}>CONNECTION</span>
              <span style={{color:isErr?'#FF5555':engineReady?'#4ade80':isConn?'#FFB800':GOLD_D,fontSize:8,fontWeight:700,letterSpacing:'.14em',fontFamily:'monospace'}}>
                {isErr?'ERROR':engineReady?'READY':isConn?'CONNECTING':'STANDBY'}
              </span>
            </div>
            {/* Wave */}
            <Wave active={isActive||isSpeak}/>
            {/* Engine label */}
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,border:`1px solid ${GOLD_BDR}`,background:'rgba(0,0,0,.60)'}}>
              <span style={{color:GOLD_D,fontSize:8,letterSpacing:'.18em',fontFamily:'monospace'}}>AI ENGINE</span>
              <div style={{width:5,height:5,borderRadius:'50%',background:isSession?stateColor:GOLD_D,boxShadow:isSession?`0 0 5px ${stateColor}`:'none'}}/>
            </div>
          </div>
        </main>

        {/* ── Right Panel (desktop only) ── */}
        <aside className="jp-right">
          {/* Status */}
          <div style={{padding:'10px 10px',borderRadius:10,border:`1px solid ${GOLD_BDR}`,background:'rgba(255,200,0,.03)'}}>
            <div style={{color:GOLD_D,fontSize:7,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:8}}>STATUS</div>
            <StatRow dot="#4ade80" label="ONLINE"     active/>
            <StatRow dot={GOLD}   label="LISTENING"  active={isActive}/>
            <StatRow dot="#FFB800" label="THINKING"   active={isProc}/>
            <StatRow dot="#00E060" label="SPEAKING"   active={isSpeak}/>
            <StatRow dot="#FF4422" label="ERROR"      active={isErr}/>
          </div>

          {/* Mode */}
          <div style={{padding:'8px 10px',borderRadius:10,border:`1px solid ${GOLD_BDR}`,background:'rgba(255,200,0,.03)'}}>
            <div style={{color:GOLD_D,fontSize:7,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:6}}>MODE</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:stateColor,boxShadow:isSession?`0 0 6px ${stateColor}`:'none'}}/>
              <span style={{fontSize:10,fontWeight:700,color:stateColor,fontFamily:'monospace',letterSpacing:'.12em',
                textShadow:isSession?`0 0 8px ${stateColor}`:'none'}}>
                {cfgKey.toUpperCase()}
              </span>
            </div>
            {voiceEngineMode === 'realtime' && (
              <button onClick={disconnectRealtime} style={{marginTop:6,fontSize:8,color:GOLD_D,background:'none',border:'none',cursor:'pointer',fontFamily:'monospace'}}>
                切断
              </button>
            )}
          </div>

          {/* Conversation */}
          {messages.length > 0 && (
            <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',gap:4}}>
              <div style={{color:GOLD_D,fontSize:7,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:4}}>CONVERSATION</div>
              {messages.slice(-6).map((m,mi)=>(
                <div key={mi} style={{fontSize:9,lineHeight:1.45,padding:'3px 7px',borderRadius:6,
                  background:m.role==='user'?'rgba(255,215,0,.07)':'rgba(255,255,255,.03)',
                  color:m.role==='user'?GOLD_B:'rgba(255,255,255,.45)',
                  overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  <span style={{opacity:.4,marginRight:3}}>{m.role==='user'?'▶':'◆'}</span>
                  {m.text.slice(0,26)}{m.text.length>26?'…':''}
                </div>
              ))}
            </div>
          )}

          {/* Quick commands */}
          <div>
            <div style={{color:GOLD_D,fontSize:7,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:6}}>QUICK COMMAND</div>
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {QUICK.map(({label,utt,Icon})=>(
                <button key={label} onClick={()=>handleUtterance(utt)}
                  disabled={isActive||isProc}
                  style={{display:'flex',alignItems:'center',gap:6,padding:'6px 8px',borderRadius:8,
                    border:`1px solid ${GOLD_BDR}`,background:'none',color:'rgba(255,255,255,.50)',
                    cursor:'pointer',fontSize:9,textAlign:'left',opacity:isActive||isProc?.4:1,
                    transition:'background .15s'}}>
                  <Icon style={{color:GOLD_D,width:11,height:11,flexShrink:0}}/>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Settings */}
          <button onClick={()=>setShowSettings(true)}
            style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'6px 0',borderRadius:8,
              border:`1px solid ${GOLD_BDR}`,background:'none',color:GOLD_D,cursor:'pointer',fontSize:9,fontFamily:'monospace',marginTop:'auto'}}>
            <Settings style={{width:11,height:11}}/>音声設定
          </button>
        </aside>
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <React.Suspense fallback={
      <div style={{display:'flex',height:'100dvh',alignItems:'center',justifyContent:'center',background:BG}}>
        <div style={{width:30,height:30,borderRadius:'50%',border:`2px solid ${GOLD}`,borderTopColor:'transparent',animation:'spin 1s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AssistantContent/>
    </React.Suspense>
  )
}
