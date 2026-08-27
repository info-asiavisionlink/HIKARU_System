'use client'

import * as React from 'react'
import { useRouter }       from 'next/navigation'
import { Settings, Volume2, Home, Bell, Calendar, Zap, X } from 'lucide-react'
import { HikaruCore }      from '@/components/voice/HikaruCore'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { browserTTS }      from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings, VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HIKARU AI Assistant — 3D Holographic JARVIS HUD
// 指示書準拠: 中央JARVIS部分タップで起動/停止。マイクボタン不要。
// Voice Logic / API / DB は一切変更なし。
// ============================================================

const BG   = '#020202'
const GD   = '#C89010'
const GB   = '#FFD700'
const GBR  = '#FFE878'
const GDim = 'rgba(200,144,16,0.42)'
const GBdr = 'rgba(200,144,16,0.16)'

// State色システム (STATUS用)
const STATUS_ITEMS = [
  { key:'idle',       label:'STANDBY',     sub:'停止中',     color:'#C89010' },
  { key:'connecting', label:'CONNECTING',  sub:'接続中',     color:'#00AFFF' },
  { key:'listening',  label:'LISTENING',   sub:'聞いています', color:'#FFD700' },
  { key:'processing', label:'THINKING',    sub:'考えています', color:'#FFB800' },
  { key:'working',    label:'PROCESSING',  sub:'処理中',     color:'#C030D8' },
  { key:'speaking',   label:'SPEAKING',    sub:'応答しています', color:'#00E060' },
  { key:'error',      label:'ERROR',       sub:'接続エラー',  color:'#FF3030' },
] as const

// ─── Waveform ────────────────────────────────────────────────
function Wave({ active, h: maxH = 16 }: { active:boolean; h?:number }) {
  const vals = [.28,.52,.75,.94,1,.96,.78,.96,1,.82,.58,.30]
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:2,height:maxH}}>
      <style>{`@keyframes jvw{0%{transform:scaleY(.1)}100%{transform:scaleY(1)}}`}</style>
      {vals.map((v,i)=>(
        <div key={i} style={{
          width:3,height:`${v*maxH}px`,borderRadius:2,
          background:active?GBR:GDim,opacity:active?.88:.22,
          animation:active?`jvw ${.38+i*.07}s ease-in-out ${i*.055}s infinite alternate`:'none',
          transformOrigin:'bottom',
        }}/>
      ))}
    </div>
  )
}

// ─── Clock ───────────────────────────────────────────────────
function Clock() {
  const [t,setT]=React.useState('')
  React.useEffect(()=>{
    const f=()=>setT(new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'}))
    f();const id=setInterval(f,1000);return()=>clearInterval(id)
  },[])
  return <>{t}</>
}

// ─── Voice Settings Panel ────────────────────────────────────
function SettingsPanel({settings,onClose,onSave}:{settings:VoiceSettings;onClose:()=>void;onSave:(s:VoiceSettings)=>void}) {
  const [l,setL]=React.useState<VoiceSettings>(settings)
  const [vs,setVs]=React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(()=>{
    const f=()=>{if(typeof window==='undefined')return;setVs(window.speechSynthesis.getVoices())}
    f();window.speechSynthesis.addEventListener?.('voiceschanged',f)
    return()=>window.speechSynthesis.removeEventListener?.('voiceschanged',f)
  },[])
  const all=vs.filter(v=>v.lang.startsWith('ja'))
  return (
    <div style={{position:'absolute',inset:0,zIndex:30,background:'#040404',border:`1px solid ${GBdr}`,
      display:'flex',flexDirection:'column',padding:20,overflowY:'auto'}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:18}}>
        <span style={{color:GBR,fontSize:11,fontWeight:700,letterSpacing:'.18em',fontFamily:'monospace'}}>VOICE SETTINGS</span>
        <button onClick={onClose} style={{color:GDim,background:'none',border:'none',cursor:'pointer'}}><X style={{width:15,height:15}}/></button>
      </div>
      <label style={{color:GDim,fontSize:8,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:5}}>音声</label>
      <select value={l.voiceURI} onChange={e=>setL(p=>({...p,voiceURI:e.target.value}))}
        style={{background:`rgba(255,200,0,.06)`,border:`1px solid ${GBdr}`,color:GBR,borderRadius:8,padding:'6px 8px',fontSize:12,marginBottom:14}}>
        <option value="">自動</option>
        {all.map(v=><option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
      </select>
      {(['rate','pitch','volume'] as const).map(k=>(
        <div key={k} style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',color:GDim,fontSize:8,letterSpacing:'.2em',fontFamily:'monospace',marginBottom:4}}>
            <span>{{rate:'速度',pitch:'ピッチ',volume:'音量'}[k]}</span>
            <span style={{color:GBR}}>{l[k].toFixed(1)}</span>
          </div>
          <input type="range" min={k==='pitch'?0:k==='volume'?0:.5} max={k==='volume'?1:2} step={.1}
            value={l[k]} onChange={e=>setL(p=>({...p,[k]:parseFloat(e.target.value)}))}
            style={{width:'100%',accentColor:GB}}/>
        </div>
      ))}
      <div style={{display:'flex',gap:8,marginTop:4}}>
        <button onClick={()=>browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。`,undefined,l)}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GBdr}`,background:'none',color:GBR,cursor:'pointer',fontSize:12,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
          <Volume2 style={{width:13,height:13}}/>試聴
        </button>
        <button onClick={()=>{onSave(l);onClose()}}
          style={{flex:1,padding:'8px 0',borderRadius:10,border:`1px solid ${GB}`,background:'rgba(255,215,0,.12)',color:GBR,cursor:'pointer',fontSize:12,fontWeight:700}}>
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Responsive HUD with click handler ───────────────────────
function JarvisHUD({ mode, isConnecting, onClick }: { mode:VoiceMode; isConnecting:boolean; onClick:()=>void }) {
  const ref=React.useRef<HTMLDivElement>(null)
  const [sz,setSz]=React.useState(340)
  React.useEffect(()=>{
    if(!ref.current)return
    const ro=new ResizeObserver(([e])=>{
      const cw=e.contentRect.width, ch=e.contentRect.height
      const byW=cw/1.05
      const byH=ch/1.42   // 1.42 = H/size ratio
      const s=Math.floor(Math.min(byW,byH,680)) // max 680px
      setSz(Math.max(s,200))
    })
    ro.observe(ref.current)
    return()=>ro.disconnect()
  },[])
  return (
    <div ref={ref}
      onClick={onClick}
      title="クリックしてJARVISを起動/停止"
      style={{
        flex:1,display:'flex',alignItems:'center',justifyContent:'center',
        minHeight:0,cursor:'pointer',
        // subtle hover highlight
      }}>
      <HikaruCore mode={mode} size={sz} isConnecting={isConnecting}/>
    </div>
  )
}

// ─── STATUS panel row ────────────────────────────────────────
function StatusRow({ item, active }: { item: typeof STATUS_ITEMS[number]; active: boolean }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',borderBottom:`1px solid rgba(200,144,16,0.08)`}}>
      <div style={{
        width:8,height:8,borderRadius:'50%',flexShrink:0,
        background:item.color,
        boxShadow:active?`0 0 8px ${item.color},0 0 16px ${item.color}55`:'none',
        opacity:active?1:.22,
        transition:'all .3s',
      }}/>
      <div style={{flex:1}}>
        <div style={{fontSize:10,fontWeight:active?700:400,color:active?item.color:'rgba(255,255,255,.28)',fontFamily:'monospace',letterSpacing:'.10em'}}>
          {item.label}
        </div>
        <div style={{fontSize:8,color:active?'rgba(255,255,255,.60)':'rgba(255,255,255,.18)',fontFamily:'sans-serif',marginTop:1}}>
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
    mode,errorMessage,
    isSession,isStandby,isSpeechSupported,
    startSession,stopSession,handleUtterance,
    voiceSettings,setVoiceSettings,
    voiceEngineMode,disconnectRealtime,
  }=useSystemJarvis()

  const isErr     = mode==='error'
  const isActive  = mode==='listening'
  const isProc    = mode==='processing'||mode==='working'
  const isSpeak   = mode==='speaking'
  const isConn    = voiceEngineMode==='realtime-connecting'
  const isReady   = voiceEngineMode==='realtime'
  const cfgKey    = isConn?'connecting':mode

  // JARVIS中央タップ → 起動/停止
  const toggleSession = () => {
    if(isSession){stopSession()}else{startSession()}
  }

  const QUICK=[
    {label:'ホームに戻る', utt:'ホームに戻って', Icon:Home},
    {label:'通知を確認',   utt:'通知を確認して', Icon:Bell},
    {label:'スケジュール', utt:'スケジュールを見せて', Icon:Calendar},
    {label:'AIに質問',    utt:'何でも聞いて',   Icon:Zap},
  ]

  const stateColor=STATUS_ITEMS.find(s=>s.key===cfgKey)?.color??GD

  // MODE display text
  const modeLabel = STATUS_ITEMS.find(s=>s.key===cfgKey)?.label??'STANDBY'
  const modeSub   = STATUS_ITEMS.find(s=>s.key===cfgKey)?.sub??'停止中'

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:BG,position:'relative',overflow:'hidden'}}>
      <style>{`
        .jp-right{display:flex;flex-direction:column;width:210px;flex-shrink:0;border-left:1px solid ${GBdr};overflow-y:auto;background:#030303}
        @media(max-width:860px){.jp-right{display:none!important}}
        @keyframes j-conn2{0%,100%{opacity:.3}50%{opacity:1}}
        .jarvis-tap:hover{filter:brightness(1.08)}
        .jarvis-tap:active{filter:brightness(.92)}
      `}</style>

      {showSettings && <SettingsPanel settings={voiceSettings} onClose={()=>setShowSettings(false)} onSave={setVoiceSettings}/>}

      {/* ── Header ── */}
      <header style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'7px 16px',flexShrink:0,borderBottom:`1px solid ${GBdr}`,background:'rgba(0,0,0,.85)',zIndex:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:'#4ade80',boxShadow:'0 0 6px #4ade80'}}/>
          <span style={{color:GDim,fontSize:9,letterSpacing:'.22em',fontFamily:'monospace'}}>AI ENGINE</span>
          <span style={{color:GDim,fontSize:9,fontFamily:'monospace',opacity:.5}}><Clock/></span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {isSession&&(
            <div style={{display:'flex',alignItems:'center',gap:5,padding:'3px 10px',borderRadius:20,
              background:'rgba(255,215,0,.12)',border:`1px solid ${GB}`,boxShadow:`0 0 10px rgba(255,215,0,.28)`}}>
              <div style={{width:5,height:5,borderRadius:'50%',background:isStandby?GDim:'#4ade80',animation:'j-conn2 1.2s ease-in-out infinite'}}/>
              <span style={{color:GBR,fontSize:9,fontWeight:700,letterSpacing:'.16em',fontFamily:'monospace'}}>
                {isStandby?'STANDBY':'ACTIVE'}
              </span>
            </div>
          )}
          <Wave active={isActive||isSpeak}/>
          <button onClick={()=>setShowSettings(p=>!p)} style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}} aria-label="設定">
            <Settings style={{width:14,height:14}}/>
          </button>
          <button onClick={()=>router.push('/home')} style={{color:GDim,background:'none',border:'none',cursor:'pointer',display:'flex',padding:4}} aria-label="閉じる">
            <X style={{width:14,height:14}}/>
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* ── Center: HUD (主役) ── */}
        <main style={{display:'flex',flex:1,flexDirection:'column',overflow:'hidden',padding:'6px 0 10px'}}>
          {/* HUD — クリックで起動/停止 */}
          <JarvisHUD mode={mode} isConnecting={isConn} onClick={toggleSession}/>

          {/* Session label */}
          <div style={{textAlign:'center',padding:'6px 0 2px',flexShrink:0}}>
            <span style={{color:isSession?GBR:GDim,fontSize:10,fontFamily:'monospace',letterSpacing:'.16em'}}>
              {isSession
                ?(isStandby?'スタンバイ中 — 話しかけてください':'会話中 — 「終了」と言うか上をタップ')
                :'JARVISをタップして起動'}
            </span>
            {isErr&&(
              <div style={{color:'#FF5555',fontSize:9,fontFamily:'monospace',marginTop:3}}>{errorMessage||'接続エラー'}</div>
            )}
            {!isSpeechSupported&&(
              <div style={{color:'rgba(255,100,60,.7)',fontSize:8,marginTop:2}}>音声入力非対応ブラウザ</div>
            )}
          </div>

          {/* Bottom status bar */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,padding:'4px 16px',flexShrink:0,flexWrap:'wrap'}}>
            {/* 接続状態 */}
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{color:GDim,fontSize:8,letterSpacing:'.18em',fontFamily:'monospace'}}>接続状態</span>
              <div style={{display:'flex',alignItems:'center',gap:3}}>
                <div style={{width:5,height:5,borderRadius:'50%',
                  background:isErr?'#FF3030':isReady?'#4ade80':isConn?'#FFB800':GD,
                  boxShadow:isReady?'0 0 5px #4ade80':isConn?'0 0 5px #FFB800':'none',
                  animation:isConn?'j-conn2 1.2s ease-in-out infinite':undefined}}/>
                <span style={{color:isErr?'#FF5555':isReady?'#4ade80':isConn?'#FFB800':GDim,fontSize:8,fontWeight:700,letterSpacing:'.14em',fontFamily:'monospace'}}>
                  {isErr?'ERROR':isReady?'READY':isConn?'CONNECTING':'STANDBY'}
                </span>
              </div>
            </div>
            {/* マイク */}
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{color:GDim,fontSize:8,letterSpacing:'.18em',fontFamily:'monospace'}}>マイク</span>
              <div style={{display:'flex',alignItems:'center',gap:3}}>
                <div style={{width:5,height:5,borderRadius:'50%',background:isSession?GB:GD,boxShadow:isSession?'0 0 5px rgba(255,215,0,.7)':'none'}}/>
                <span style={{color:isSession?GB:GDim,fontSize:8,fontWeight:700,fontFamily:'monospace'}}>{isSession?'ON':'OFF'}</span>
              </div>
            </div>
            {/* Wave */}
            <Wave active={isActive||isSpeak} h={14}/>
            {/* AIモデル */}
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{color:GDim,fontSize:8,letterSpacing:'.18em',fontFamily:'monospace'}}>AIモデル</span>
              <span style={{color:GBR,fontSize:8,fontWeight:700,fontFamily:'monospace',letterSpacing:'.10em'}}>HIKARU AI</span>
            </div>
          </div>
        </main>

        {/* ── Right Panel ── */}
        <aside className="jp-right" style={{display:'flex'}}>
          <div style={{display:'flex',flexDirection:'column',gap:0,padding:'12px 14px',flex:1}}>

            {/* STATUS */}
            <div style={{marginBottom:14}}>
              <div style={{color:GDim,fontSize:8,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:8}}>STATUS（ステータス）</div>
              {STATUS_ITEMS.map(item=>(
                <StatusRow key={item.key} item={item} active={cfgKey===item.key}/>
              ))}
            </div>

            {/* MODE */}
            <div style={{marginBottom:14,padding:'10px 12px',borderRadius:10,border:`1px solid ${GBdr}`,background:'rgba(255,200,0,.03)'}}>
              <div style={{color:GDim,fontSize:8,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:8}}>MODE（モード）</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div>
                  <div style={{color:stateColor,fontSize:15,fontWeight:800,fontFamily:'monospace',letterSpacing:'.12em',
                    textShadow:isSession?`0 0 10px ${stateColor}`:undefined}}>
                    {modeLabel}
                  </div>
                  <div style={{color:'rgba(255,255,255,.40)',fontSize:9,marginTop:2,fontFamily:'sans-serif'}}>
                    {modeSub}
                  </div>
                </div>
                <Wave active={isActive||isSpeak} h={18}/>
              </div>
              {voiceEngineMode==='realtime'&&(
                <button onClick={disconnectRealtime}
                  style={{marginTop:8,fontSize:8,color:GDim,background:'none',border:`1px solid ${GBdr}`,cursor:'pointer',borderRadius:6,padding:'3px 8px',fontFamily:'monospace'}}>
                  切断
                </button>
              )}
            </div>

            {/* QUICK ACTION */}
            <div style={{marginBottom:14}}>
              <div style={{color:GDim,fontSize:8,letterSpacing:'.24em',fontFamily:'monospace',marginBottom:8}}>QUICK ACTION</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {QUICK.map(({label,utt,Icon})=>(
                  <button key={label} onClick={()=>handleUtterance(utt)}
                    disabled={isActive||isProc}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                      gap:4,padding:'8px 4px',borderRadius:10,border:`1px solid ${GBdr}`,
                      background:'rgba(255,200,0,.04)',color:'rgba(255,255,255,.55)',
                      cursor:'pointer',fontSize:8.5,textAlign:'center',
                      opacity:isActive||isProc?.4:1,transition:'background .15s'}}>
                    <Icon style={{color:GD,width:16,height:16}}/>
                    <span style={{lineHeight:1.3}}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Settings */}
            <button onClick={()=>setShowSettings(true)}
              style={{display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'7px 0',
                borderRadius:8,border:`1px solid ${GBdr}`,background:'none',color:GDim,
                cursor:'pointer',fontSize:9,fontFamily:'monospace',marginTop:'auto',letterSpacing:'.14em'}}>
              <Settings style={{width:11,height:11}}/>音声設定
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
        <div style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${GB}`,borderTopColor:'transparent',animation:'spin 1s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AssistantContent/>
    </React.Suspense>
  )
}
