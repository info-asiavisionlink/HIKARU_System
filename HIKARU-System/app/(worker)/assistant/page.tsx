'use client'

import * as React from 'react'
import { useRouter }       from 'next/navigation'
import { Mic, X, Settings, Volume2, Radio, MicOff } from 'lucide-react'
import { HikaruCore }      from '@/components/voice/HikaruCore'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { browserTTS }      from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings, VoiceMode } from '@/lib/voice/state/types'

// ============================================================
// HIKARU AI Assistant — JARVIS HUD (参考画像準拠)
// HUDを画面中央の主役として大きく表示。
// ============================================================

const GOLD        = '#FFD700'
const GOLD_BRIGHT = '#FFE878'
const GOLD_SOFT   = '#FFCC33'
const GOLD_DIM    = 'rgba(255,200,60,0.45)'
const GOLD_FAINT  = 'rgba(255,200,0,0.10)'
const GOLD_BORDER = 'rgba(255,200,0,0.22)'
const ERROR_COL   = '#FF4422'
const BG_DARK     = '#030303'

// ─── Waveform bar ────────────────────────────────────────────
function WaveBar({ active, size = 'sm' }: { active: boolean; size?: 'sm' | 'md' }) {
  const h = [0.35, 0.6, 0.85, 1.0, 0.75, 1.0, 0.85, 0.55, 0.35]
  const maxH = size === 'md' ? 24 : 16
  return (
    <div className="flex items-end gap-[2px]" style={{ height: maxH, alignItems: 'center' }}>
      <style>{`
        @keyframes hk-wb { 0%{transform:scaleY(.15)} 100%{transform:scaleY(1)} }
        @media(prefers-reduced-motion:reduce){.hk-wb{animation:none!important;transform:scaleY(.4)!important}}
      `}</style>
      {h.map((v, i) => (
        <div key={i} className="hk-wb w-[3px] rounded-full"
          style={{
            background: GOLD_BRIGHT,
            height: `${v * maxH}px`,
            opacity: active ? 0.88 : 0.22,
            animation: active ? `hk-wb ${0.45 + i * 0.08}s ease-in-out ${i * 0.06}s infinite alternate` : 'none',
            transformOrigin: 'bottom',
          }} />
      ))}
    </div>
  )
}

// ─── Live clock ──────────────────────────────────────────────
function LiveClock() {
  const [t, setT] = React.useState('')
  React.useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])
  return <>{t}</>
}

// ─── Voice Settings Panel ───────────────────────────────────
function VoiceSettingsPanel({ settings, onClose, onSave }: {
  settings: VoiceSettings; onClose: () => void; onSave: (s: VoiceSettings) => void
}) {
  const [local, setLocal]   = React.useState<VoiceSettings>(settings)
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([])
  React.useEffect(() => {
    const load = () => { if (typeof window === 'undefined') return; setVoices(window.speechSynthesis.getVoices()) }
    load(); window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [])
  const jp = voices.filter(v => v.lang.startsWith('ja'))
  const all = jp.length > 0 ? jp : voices
  return (
    <div className="absolute inset-0 z-20 flex flex-col p-5 overflow-y-auto"
      style={{ background: '#040404', border: `1px solid ${GOLD_BORDER}` }}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold tracking-[0.18em] uppercase" style={{ color: GOLD_BRIGHT }}>VOICE SETTINGS</p>
        <button onClick={onClose} style={{ color: GOLD_DIM }}><X className="h-4 w-4" /></button>
      </div>
      <label className="text-[10px] tracking-[0.2em] uppercase mb-1.5 block" style={{ color: GOLD_DIM }}>音声</label>
      <select value={local.voiceURI} onChange={e => setLocal(p => ({...p, voiceURI: e.target.value}))}
        className="w-full rounded-lg px-3 py-2 text-sm mb-4"
        style={{ background: GOLD_FAINT, border: `1px solid ${GOLD_BORDER}`, color: GOLD_BRIGHT }}>
        <option value="">自動</option>
        {all.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
      </select>
      {(['rate','pitch','volume'] as const).map(key => (
        <div key={key} className="mb-4">
          <label className="text-[10px] tracking-[0.2em] uppercase mb-1.5 flex justify-between" style={{ color: GOLD_DIM }}>
            <span>{{ rate:'速度', pitch:'ピッチ', volume:'音量' }[key]}</span>
            <span style={{ color: GOLD_BRIGHT }}>{local[key].toFixed(1)}</span>
          </label>
          <input type="range" min={key==='pitch'?0:key==='volume'?0:0.5} max={key==='volume'?1.0:2.0} step={0.1}
            value={local[key]} onChange={e => setLocal(p => ({...p, [key]: parseFloat(e.target.value)}))}
            className="w-full" style={{ accentColor: GOLD }} />
        </div>
      ))}
      <div className="flex gap-2 mt-2">
        <button onClick={() => browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。`, undefined, local)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
          style={{ background: GOLD_FAINT, border: `1px solid ${GOLD_BORDER}`, color: GOLD_BRIGHT }}>
          <Volume2 className="h-4 w-4" />試聴
        </button>
        <button onClick={() => { onSave(local); onClose() }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold"
          style={{ background: `rgba(255,200,0,0.18)`, border: `1px solid ${GOLD}`, color: GOLD_BRIGHT }}>
          保存
        </button>
      </div>
    </div>
  )
}

// ─── HikaruCore sized ────────────────────────────────────────
function HikaruCoreSized({ mode, isConnecting }: { mode: VoiceMode; isConnecting: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [sz, setSz] = React.useState(360)
  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => {
      const s = Math.floor(Math.min(e.contentRect.width, e.contentRect.height))
      setSz(s > 0 ? s : 360)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return (
    <div ref={ref} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <HikaruCore mode={mode} size={sz} isConnecting={isConnecting} />
    </div>
  )
}

// ─── Mic Button ─────────────────────────────────────────────
function MicButton({ isSession, isProcessing, onClick }: {
  isSession: boolean; isProcessing: boolean; onClick: () => void
}) {
  const [hover, setHover] = React.useState(false)
  const glow = isSession
    ? `0 0 14px rgba(255,200,0,.80), 0 0 30px rgba(255,180,0,.45), 0 0 55px rgba(255,150,0,.22)`
    : hover
    ? `0 0 10px rgba(255,200,0,.50), 0 0 22px rgba(255,180,0,.28)`
    : `0 0 6px rgba(255,180,0,.20)`
  return (
    <button
      onClick={onClick}
      disabled={isProcessing}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={isSession ? 'JARVIS停止' : 'JARVIS起動'}
      style={{
        width: 82, height: 82,
        borderRadius: '50%',
        border: `2px solid ${isSession ? GOLD : GOLD_SOFT}`,
        background: isSession ? `rgba(255,200,0,0.14)` : `rgba(255,200,0,0.06)`,
        boxShadow: glow,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: isProcessing ? 'not-allowed' : 'pointer',
        opacity: isProcessing ? 0.5 : 1,
        transform: hover && !isProcessing ? 'scale(1.04)' : 'scale(1)',
        transition: 'transform .18s, box-shadow .18s, background .18s',
        flexShrink: 0,
      }}>
      {isSession
        ? <Radio  style={{ color: GOLD_BRIGHT, width: 34, height: 34 }} />
        : <Mic    style={{ color: GOLD,        width: 34, height: 34 }} />
      }
    </button>
  )
}

// ─── Connection status bar ───────────────────────────────────
function ConnectionBar({ voiceEngineMode, isError }: { voiceEngineMode: string; isError: boolean }) {
  const isReady      = voiceEngineMode === 'realtime'
  const isConnecting = voiceEngineMode === 'realtime-connecting'
  const dotColor     = isError ? ERROR_COL : isReady ? '#4ade80' : isConnecting ? '#FFB800' : GOLD_DIM
  const label        = isError ? 'ERROR' : isReady ? 'READY' : isConnecting ? 'CONNECTING' : 'STANDBY'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      border: `1px solid ${isError ? ERROR_COL+'44' : GOLD_BORDER}`,
      background: 'rgba(0,0,0,0.55)',
    }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: dotColor,
        boxShadow: `0 0 6px ${dotColor}`,
        animation: isConnecting ? 'hk-glow-pulse 1.2s ease-in-out infinite' : undefined,
      }}/>
      <span style={{ color: GOLD_DIM, fontSize: 9, letterSpacing: '0.22em', fontFamily: 'monospace' }}>
        CONNECTION
      </span>
      <span style={{ color: isError ? ERROR_COL : isReady ? '#4ade80' : GOLD_BRIGHT, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', fontFamily: 'monospace' }}>
        {label}
      </span>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────
function AssistantPageContent() {
  const router = useRouter()
  const [showSettings, setShowSettings] = React.useState(false)

  const {
    mode, errorMessage, messages,
    isSession, isStandby, isSpeechSupported,
    startSession, stopSession, handleUtterance,
    voiceSettings, setVoiceSettings,
    voiceEngineMode, connectRealtime, disconnectRealtime,
  } = useSystemJarvis()

  const isError      = mode === 'error'
  const isActive     = mode === 'listening'
  const isProc       = mode === 'processing'
  const isWork       = mode === 'working'
  const isSpeak      = mode === 'speaking'
  const isConnecting = voiceEngineMode === 'realtime-connecting'

  const handleToggle = () => isSession ? stopSession() : startSession()

  // ── State label text ──
  const stateText = isConnecting
    ? { main: 'LINK', sub: '接続中...' }
    : {
      idle:       { main: 'JARVIS',   sub: isStandby ? 'STANDBY' : 'STANDBY' },
      listening:  { main: 'JARVIS',   sub: 'LISTENING' },
      processing: { main: 'JARVIS',   sub: 'THINKING' },
      working:    { main: 'JARVIS',   sub: 'WORKING' },
      speaking:   { main: 'JARVIS',   sub: 'SPEAKING' },
      error:      { main: 'JARVIS',   sub: 'ERROR' },
    }[mode] ?? { main: 'JARVIS', sub: 'STANDBY' }

  // ── Layout ───────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100dvh',
      background: BG_DARK, position: 'relative', overflow: 'hidden',
    }}>
      {/* keyframes for connection bar dot */}
      <style>{`
        @keyframes hk-glow-pulse { 0%,100%{opacity:.4} 50%{opacity:1} }
      `}</style>

      {/* Settings overlay */}
      {showSettings && (
        <VoiceSettingsPanel settings={voiceSettings} onClose={() => setShowSettings(false)} onSave={setVoiceSettings} />
      )}

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', flexShrink: 0,
        borderBottom: `1px solid ${GOLD_BORDER}`,
        background: 'rgba(0,0,0,0.72)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80' }}/>
          <span style={{ color: GOLD_DIM, fontSize: 9, letterSpacing: '0.24em', fontFamily: 'monospace' }}>
            AI ENGINE
          </span>
          <span style={{ color: GOLD_DIM, fontSize: 9, fontFamily: 'monospace', opacity: 0.6 }}>
            <LiveClock />
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSession && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 20,
              background: 'rgba(255,200,0,0.14)', border: `1px solid ${GOLD}`,
              boxShadow: `0 0 10px rgba(255,200,0,0.30)`,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: isStandby ? GOLD_DIM : '#4ade80', animation: 'hk-glow-pulse 1.2s ease-in-out infinite' }}/>
              <span style={{ color: GOLD_BRIGHT, fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', fontFamily: 'monospace' }}>
                {isStandby ? 'STANDBY' : 'ACTIVE'}
              </span>
            </div>
          )}
          <WaveBar active={isActive || isSpeak} />
          <button onClick={() => setShowSettings(p => !p)} style={{ color: GOLD_DIM, display: 'flex', padding: 4 }} aria-label="設定">
            <Settings style={{ width: 15, height: 15 }} />
          </button>
          <button onClick={() => router.push('/home')} style={{ color: GOLD_DIM, display: 'flex', padding: 4 }} aria-label="閉じる">
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left panel (desktop only, minimal) ── */}
        <aside style={{
          display: 'none', // hidden on mobile
          flexDirection: 'column', gap: 12, padding: 16, width: 160, flexShrink: 0,
          borderRight: `1px solid ${GOLD_BORDER}`,
        }} className="hidden-xs md-flex">
          <style>{`.md-flex{display:flex!important} @media(max-width:767px){.md-flex{display:none!important}}`}</style>
          {/* Session button */}
          <button onClick={handleToggle} disabled={isProc || isWork}
            style={{
              padding: '10px 0', borderRadius: 12, border: `1px solid ${isSession ? GOLD : GOLD_BORDER}`,
              background: isSession ? 'rgba(255,200,0,0.12)' : 'rgba(255,200,0,0.04)',
              boxShadow: isSession ? `0 0 12px rgba(255,200,0,0.30)` : 'none',
              color: isSession ? GOLD_BRIGHT : GOLD_DIM, cursor: 'pointer', opacity: (isProc||isWork) ? 0.4 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
            <Radio style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 9, letterSpacing: '0.18em', fontFamily: 'monospace', fontWeight: 700 }}>
              {isSession ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </button>
          {/* Voice engine */}
          <div style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${GOLD_BORDER}`, background: 'rgba(255,200,0,0.04)' }}>
            <div style={{ fontSize: 8, color: GOLD_DIM, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 6 }}>VOICE ENGINE</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: voiceEngineMode === 'realtime' ? '#4ade80' : voiceEngineMode === 'realtime-connecting' ? '#FFB800' : GOLD_DIM }}/>
              <span style={{ fontSize: 9, color: voiceEngineMode === 'realtime' ? '#4ade80' : GOLD_BRIGHT, fontFamily: 'monospace', fontWeight: 700 }}>
                {voiceEngineMode === 'realtime' ? 'REALTIME' : voiceEngineMode === 'realtime-connecting' ? 'LINK...' : 'OFF'}
              </span>
            </div>
            {voiceEngineMode === 'realtime' && (
              <button onClick={disconnectRealtime} style={{ fontSize: 8, color: GOLD_DIM, marginTop: 4, cursor: 'pointer', background: 'none', border: 'none' }}>
                切断
              </button>
            )}
          </div>
          {/* Recent messages mini */}
          {messages.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 8, color: GOLD_DIM, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 2 }}>LOG</div>
              {messages.slice(-4).map((m, i) => (
                <div key={i} style={{
                  fontSize: 9, lineHeight: 1.4, padding: '3px 6px', borderRadius: 6,
                  background: m.role === 'user' ? 'rgba(255,200,0,0.06)' : 'rgba(255,255,255,0.03)',
                  color: m.role === 'user' ? GOLD_BRIGHT : 'rgba(255,255,255,0.55)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  <span style={{ opacity: 0.5, marginRight: 3 }}>{m.role === 'user' ? '>' : '◆'}</span>
                  {m.text.slice(0, 28)}{m.text.length > 28 ? '…' : ''}
                </div>
              ))}
            </div>
          )}
          <button onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderRadius: 8, border: `1px solid ${GOLD_BORDER}`, background: 'none', color: GOLD_DIM, cursor: 'pointer', marginTop: 'auto', fontSize: 9 }}>
            <Settings style={{ width: 11, height: 11 }} /> 音声設定
          </button>
        </aside>

        {/* ── Center: HUD main area ── */}
        <main style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flex: 1, padding: '12px 8px 20px', gap: 16, overflow: 'hidden',
        }}>
          {/* HUD circle - takes most of the space */}
          <div style={{
            position: 'relative',
            width: 'clamp(260px, min(44vw, 56vh), 500px)',
            height: 'clamp(260px, min(44vw, 56vh), 500px)',
            flexShrink: 0,
          }}>
            <HikaruCoreSized mode={mode} isConnecting={isConnecting} />
          </div>

          {/* Mic button */}
          <MicButton isSession={isSession} isProcessing={isProc || isWork} onClick={handleToggle} />

          {/* Session label */}
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ color: isSession ? GOLD_BRIGHT : GOLD_DIM, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.18em' }}>
              {isSession ? (isStandby ? 'スタンバイ中 — 話しかけてください' : '会話中 — 「終了」で停止') : 'タップしてJARVISを起動'}
            </span>
            {!isSpeechSupported && (
              <span style={{ color: 'rgba(255,100,80,0.8)', fontSize: 9 }}>
                このブラウザでは音声入力を利用できません
              </span>
            )}
            {isError && (
              <span style={{ color: ERROR_COL, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.12em' }}>
                {errorMessage || '接続エラー'}
              </span>
            )}
          </div>

          {/* Bottom info bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
            <ConnectionBar voiceEngineMode={voiceEngineMode} isError={isError} />
            <WaveBar active={isActive || isSpeak} size="md" />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20,
              border: `1px solid ${GOLD_BORDER}`, background: 'rgba(0,0,0,0.55)',
            }}>
              <span style={{ fontSize: 9, color: GOLD_DIM, letterSpacing: '0.18em', fontFamily: 'monospace' }}>AI MODEL</span>
              <span style={{ fontSize: 9, color: GOLD_BRIGHT, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'monospace' }}>GPT-4o</span>
            </div>
          </div>
        </main>

        {/* ── Right panel (desktop only, minimal) ── */}
        <aside style={{ flexDirection: 'column', gap: 10, padding: 16, width: 160, flexShrink: 0, borderLeft: `1px solid ${GOLD_BORDER}` }}
          className="hidden-xs md-flex">
          {/* Status */}
          <div style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${GOLD_BORDER}`, background: 'rgba(255,200,0,0.04)' }}>
            <div style={{ fontSize: 8, color: GOLD_DIM, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 6 }}>STATUS</div>
            {[
              { dot: '#4ade80', label: 'ONLINE' },
              { dot: isSession ? GOLD : GOLD_DIM, label: isSession ? 'SESSION ON' : 'IDLE' },
              { dot: GOLD, label: 'READY' },
            ].map(({dot, label}) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: dot, boxShadow: `0 0 4px ${dot}` }}/>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>{label}</span>
              </div>
            ))}
          </div>
          {/* Mode state */}
          <div style={{ padding: '8px 10px', borderRadius: 10, border: `1px solid ${GOLD_BORDER}`, background: 'rgba(255,200,0,0.04)' }}>
            <div style={{ fontSize: 8, color: GOLD_DIM, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 6 }}>MODE</div>
            <div style={{
              fontSize: 11, color: isError ? ERROR_COL : GOLD_BRIGHT, fontWeight: 700,
              letterSpacing: '0.14em', fontFamily: 'monospace',
              textShadow: isError ? `0 0 8px ${ERROR_COL}` : `0 0 8px rgba(255,200,0,0.6)`,
            }}>
              {mode.toUpperCase()}
            </div>
          </div>
          {/* Recent conv */}
          {messages.length > 0 && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 8, color: GOLD_DIM, letterSpacing: '0.2em', fontFamily: 'monospace', marginBottom: 4 }}>CONV</div>
              {messages.slice(-5).map((m, i) => (
                <div key={i} style={{
                  fontSize: 9, lineHeight: 1.4, marginBottom: 3, padding: '3px 6px', borderRadius: 5,
                  background: m.role === 'user' ? 'rgba(255,200,0,0.06)' : 'rgba(255,255,255,0.03)',
                  color: m.role === 'user' ? GOLD_SOFT : 'rgba(255,255,255,0.45)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m.text.slice(0, 22)}{m.text.length > 22 ? '…' : ''}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Mobile: bottom controls ── */}
      <div className="md-flex" style={{ display: 'none' }}>
        <style>{`@media(max-width:767px){.mob-bar{display:flex!important}}`}</style>
      </div>
      <div className="mob-bar" style={{
        display: 'none', flexDirection: 'column', alignItems: 'center', gap: 10, paddingBottom: 16,
      }}>
        <ConnectionBar voiceEngineMode={voiceEngineMode} isError={isError} />
      </div>
    </div>
  )
}

export default function AssistantPage() {
  return (
    <React.Suspense fallback={
      <div style={{ display:'flex', minHeight:'100dvh', alignItems:'center', justifyContent:'center', background: '#030303' }}>
        <div style={{ width:32, height:32, borderRadius:'50%', border:'2px solid #FFD700', borderTopColor:'transparent', animation:'spin 1s linear infinite' }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    }>
      <AssistantPageContent />
    </React.Suspense>
  )
}
