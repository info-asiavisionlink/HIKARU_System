'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic, MicOff, X, Activity, Clock, CheckCircle, Bell,
  Home, Calendar, Zap, ChevronRight, Radio, Settings, Volume2,
} from 'lucide-react'
import { HikaruCore } from '@/components/voice/HikaruCore'
import { useSystemJarvis } from '@/lib/voice/SystemVoiceContext'
import { browserTTS }      from '@/lib/voice/tts/browser'
import { VOICE_ASSISTANT_NAME } from '@/lib/voice/config'
import type { VoiceSettings } from '@/lib/voice/state/types'

// ============================================================
// HIKARU AI Assistant — 専用Voice Interface
// useSystemJarvis() でProviderのPersistent Sessionを消費。
// ============================================================

const G  = 'oklch(0.73 0.12 78)'
const GB = 'oklch(0.88 0.13 78)'
const GD = 'oklch(0.73 0.12 78 / 0.50)'

const STATE_TEXT: Record<string, { sub: string }> = {
  idle:       { sub: `${VOICE_ASSISTANT_NAME}があなたの音声をお待ちしています` },
  listening:  { sub: '音声を聞いています...' },
  processing: { sub: '内容を確認しています...' },
  speaking:   { sub: `HIKARU AIが回答しています...` },
  error:      { sub: 'もう一度お試しください' },
}

const EXAMPLE_COMMANDS = [
  '今日の仕事を教えて',
  '通知を確認して',
  'スケジュールは？',
  'マニュアルを開いて',
]

const QUICK_COMMANDS = [
  { label: 'ホームに戻る',     utterance: 'ホームに戻って',       Icon: Home     },
  { label: '通知を確認',       utterance: '通知を確認して',       Icon: Bell     },
  { label: 'スケジュール確認', utterance: 'スケジュールを見せて', Icon: Calendar },
  { label: 'AIに質問',         utterance: 'AI質問',              Icon: Zap      },
]

// ─── Voice wave bars ─────────────────────────────────────────
function VoiceWave({ active }: { active: boolean }) {
  const heights = [0.4, 0.7, 1.0, 0.7, 0.4, 0.6, 0.9, 0.6, 0.4]
  return (
    <div className="flex items-center gap-[3px]" style={{ height: 20 }}>
      <style>{`
        @keyframes hk-wave { 0% { transform: scaleY(0.35); } 100% { transform: scaleY(1); } }
        @media (prefers-reduced-motion: reduce) { .hk-wave-bar { animation: none !important; transform: scaleY(0.5) !important; } }
      `}</style>
      {heights.map((h, i) => (
        <div
          key={i}
          className="hk-wave-bar w-[3px] rounded-full"
          style={{
            background: G,
            height: `${h * 100}%`,
            opacity: active ? 0.9 : 0.3,
            animation: active ? `hk-wave ${0.55 + i * 0.09}s ease-in-out ${i * 0.07}s infinite alternate` : 'none',
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  )
}

// ─── Live clock ──────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = React.useState('')
  React.useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return <>{time}</>
}

function StatusRow({ Icon, label, color, glow }: { Icon: React.ElementType; label: string; color: string; glow?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color, boxShadow: glow ? `0 0 6px ${color}` : undefined }} />
      <Icon className="h-3 w-3 shrink-0" style={{ color }} />
      <span className="text-xs" style={{ color: 'oklch(0.70 0.008 75)' }}>{label}</span>
    </div>
  )
}

function MemoryRow({ Icon, label, value }: { Icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3" style={{ color: G }} />
        <span className="text-xs" style={{ color: 'oklch(0.60 0.007 75)' }}>{label}</span>
      </div>
      <span className="text-xs font-medium" style={{ color: 'oklch(0.75 0.010 75)' }}>{value}</span>
    </div>
  )
}

function useMemorySummary() {
  const [data, setData] = React.useState({ jobs: '—', completed: '—', notifications: '—' })
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [homeRes, notifRes] = await Promise.all([
          fetch('/api/home/data', { credentials: 'include' }),
          fetch('/api/notifications', { credentials: 'include' }),
        ])
        if (cancelled) return
        const home  = homeRes.ok  ? await homeRes.json()  : null
        const notif = notifRes.ok ? await notifRes.json() : null
        const notifList = Array.isArray(notif?.data) ? notif.data : Array.isArray(notif) ? notif : []
        setData({
          jobs:          home?.summary?.inProgress  != null ? String(home.summary.inProgress)  : '—',
          completed:     home?.summary?.completed   != null ? String(home.summary.completed)   : '—',
          notifications: String(notifList.filter((n: { is_read?: boolean }) => !n.is_read).length),
        })
      } catch {}
    }
    load()
    return () => { cancelled = true }
  }, [])
  return data
}

// ─── Voice Selection Panel ───────────────────────────────────
function VoiceSettingsPanel({
  settings,
  onClose,
  onSave,
}: {
  settings:  VoiceSettings
  onClose:   () => void
  onSave:    (s: VoiceSettings) => void
}) {
  const [local, setLocal]   = React.useState<VoiceSettings>(settings)
  const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([])

  React.useEffect(() => {
    const load = () => {
      if (typeof window === 'undefined') return
      const list = window.speechSynthesis.getVoices()
      setVoices(list)
    }
    load()
    window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [])

  const jpVoices = voices.filter(v => v.lang.startsWith('ja'))
  const allVoices = jpVoices.length > 0 ? jpVoices : voices

  const handlePreview = () => {
    browserTTS.speak(`こんにちは。私は${VOICE_ASSISTANT_NAME}です。音声テストです。`, undefined, local)
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col p-5 overflow-y-auto"
      style={{ background: 'oklch(0.04 0.002 260)' }}
    >
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-bold tracking-[0.15em] uppercase" style={{ color: GB }}>
          VOICE SETTINGS
        </p>
        <button onClick={onClose} style={{ color: GD }}><X className="h-4 w-4" /></button>
      </div>

      {/* Voice選択 */}
      <div className="mb-4">
        <label className="text-[10px] tracking-[0.2em] uppercase mb-2 block" style={{ color: GD }}>
          音声
        </label>
        <select
          value={local.voiceURI}
          onChange={e => setLocal(p => ({ ...p, voiceURI: e.target.value }))}
          className="w-full rounded-lg px-3 py-2 text-sm"
          style={{ background: `${G}10`, border: `1px solid ${G}30`, color: 'oklch(0.82 0.008 75)' }}
        >
          <option value="">自動（日本語優先）</option>
          {allVoices.map(v => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      {/* Rate */}
      <div className="mb-4">
        <label className="text-[10px] tracking-[0.2em] uppercase mb-2 flex justify-between" style={{ color: GD }}>
          <span>速度</span><span style={{ color: GB }}>{local.rate.toFixed(1)}</span>
        </label>
        <input type="range" min={0.5} max={2.0} step={0.1}
          value={local.rate}
          onChange={e => setLocal(p => ({ ...p, rate: parseFloat(e.target.value) }))}
          className="w-full accent-amber-400"
        />
      </div>

      {/* Pitch */}
      <div className="mb-4">
        <label className="text-[10px] tracking-[0.2em] uppercase mb-2 flex justify-between" style={{ color: GD }}>
          <span>ピッチ</span><span style={{ color: GB }}>{local.pitch.toFixed(1)}</span>
        </label>
        <input type="range" min={0} max={2.0} step={0.1}
          value={local.pitch}
          onChange={e => setLocal(p => ({ ...p, pitch: parseFloat(e.target.value) }))}
          className="w-full accent-amber-400"
        />
      </div>

      {/* Volume */}
      <div className="mb-5">
        <label className="text-[10px] tracking-[0.2em] uppercase mb-2 flex justify-between" style={{ color: GD }}>
          <span>音量</span><span style={{ color: GB }}>{local.volume.toFixed(1)}</span>
        </label>
        <input type="range" min={0} max={1.0} step={0.1}
          value={local.volume}
          onChange={e => setLocal(p => ({ ...p, volume: parseFloat(e.target.value) }))}
          className="w-full accent-amber-400"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handlePreview}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95"
          style={{ background: `${G}14`, border: `1px solid ${G}40`, color: GB }}
        >
          <Volume2 className="h-4 w-4" />
          試聴
        </button>
        <button
          onClick={() => { onSave(local); onClose() }}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-all active:scale-95"
          style={{ background: `${G}28`, border: `1px solid ${G}`, color: GB }}
        >
          保存
        </button>
      </div>
    </div>
  )
}

// ─── Main page content ───────────────────────────────────────
function AssistantPageContent() {
  const router = useRouter()
  const [showVoiceSettings, setShowVoiceSettings] = React.useState(false)

  const {
    mode, errorMessage, messages, isSpeechSupported,
    isSession, isStandby,
    startListening, stopAll, handleUtterance,
    startSession, stopSession,
    voiceSettings, setVoiceSettings,
  } = useSystemJarvis()

  const memory   = useMemorySummary()
  const stateObj = STATE_TEXT[mode] ?? STATE_TEXT.idle
  const isError  = mode === 'error'
  const isActive = mode === 'listening'
  const isProc   = mode === 'processing'
  const isSpeak  = mode === 'speaking'

  const handleMicClick = () => {
    if (isActive || isProc) { stopAll(); return }
    startListening()
  }

  const handleSessionToggle = () => {
    if (isSession) { stopSession(); return }
    startSession()
  }

  const handleQuick = (utterance: string) => {
    if (isActive || isProc) return
    handleUtterance(utterance)
  }

  const statusSub = isStandby
    ? `${VOICE_ASSISTANT_NAME}はスタンバイ中です。話しかけてください。`
    : (isError ? (errorMessage || stateObj.sub) : stateObj.sub)

  // ── Left Voice Panel ─────────────────────────────────────────
  const LeftPanel = (
    <aside
      className="hidden md:flex flex-col gap-4 p-4 shrink-0 overflow-y-auto"
      style={{ width: 224, borderRight: `1px solid ${G}1a` }}
    >
      {/* Name card */}
      <div className="rounded-xl p-3" style={{ background: `${G}0e`, border: `1px solid ${G}2a` }}>
        <p
          className="text-lg font-black tracking-[0.08em]"
          style={{
            background: `linear-gradient(90deg, ${G}, ${GB})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}
        >
          {VOICE_ASSISTANT_NAME}
        </p>
        <p className="text-[9px] tracking-[0.22em] uppercase mt-0.5" style={{ color: GD }}>
          AI ASSISTANT
        </p>
      </div>

      {/* Voice status */}
      <div className="rounded-xl p-3 space-y-2.5" style={{ background: `${G}09`, border: `1px solid ${G}1e` }}>
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{
              background: isError ? '#f87171' : isStandby ? GD : isActive ? '#4ade80' : G,
              boxShadow: isActive ? '0 0 8px #4ade80' : undefined,
            }}
          />
          <span className="text-xs leading-tight" style={{ color: isError ? '#f87171' : isStandby ? GD : 'oklch(0.78 0.010 75)' }}>
            {statusSub}
          </span>
        </div>
        <VoiceWave active={isActive || isSpeak} />
      </div>

      {/* Example commands */}
      <div className="space-y-1">
        <p className="text-[9px] tracking-[0.25em] uppercase" style={{ color: GD }}>お話しください</p>
        {EXAMPLE_COMMANDS.map((cmd) => (
          <div key={cmd} className="text-[11px] py-0.5 pl-2" style={{ color: 'oklch(0.58 0.008 75)' }}>{cmd}</div>
        ))}
      </div>

      {/* 話す button */}
      <button
        onClick={handleMicClick}
        disabled={isProc || isSession}
        className="flex flex-col items-center gap-2 rounded-xl py-4 transition-all duration-200 active:scale-95 disabled:opacity-40"
        style={{
          background: isActive ? 'oklch(0.62 0.24 22 / 0.12)' : `${G}10`,
          border: `1px solid ${isActive ? 'oklch(0.62 0.24 22 / 0.6)' : `${G}44`}`,
        }}
        aria-label={isActive ? '停止' : `${VOICE_ASSISTANT_NAME}に話す`}
      >
        {isActive
          ? <MicOff className="h-6 w-6" style={{ color: 'oklch(0.78 0.24 22)' }} />
          : <Mic    className="h-6 w-6" style={{ color: GB }} />
        }
        <span className="text-xs font-bold tracking-wide" style={{ color: isActive ? 'oklch(0.78 0.24 22)' : GB }}>
          {isActive ? '停止' : '1回話す'}
        </span>
      </button>

      {/* Hands-Free Session button */}
      <button
        onClick={handleSessionToggle}
        disabled={isProc}
        className="flex flex-col items-center gap-2 rounded-xl py-4 transition-all duration-200 active:scale-95 disabled:opacity-40"
        style={{
          background: isSession ? `${G}20` : `${G}08`,
          border: `1px solid ${isSession ? G : `${G}30`}`,
          boxShadow: isSession ? `0 0 16px ${G}40` : 'none',
        }}
        aria-label={isSession ? '会話終了' : 'ハンズフリー会話開始'}
      >
        <Radio className="h-6 w-6" style={{ color: isSession ? GB : GD }} />
        <span className="text-xs font-bold" style={{ color: isSession ? GB : GD }}>
          {isSession ? (isStandby ? 'スタンバイ中' : '会話中') : 'ハンズフリー'}
        </span>
        <span className="text-[9px]" style={{ color: GD }}>
          {isSession ? '「終了」で停止' : '自動で聞き続ける'}
        </span>
      </button>

      {/* Voice Settings */}
      <button
        onClick={() => setShowVoiceSettings(true)}
        className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs transition-all active:scale-95 mt-auto"
        style={{ background: `${G}08`, border: `1px solid ${G}20`, color: GD }}
      >
        <Settings className="h-3.5 w-3.5" />
        音声設定
      </button>
    </aside>
  )

  // ── Right Status Panel ────────────────────────────────────────
  const RightPanel = (
    <aside
      className="hidden lg:flex flex-col gap-4 p-4 shrink-0 overflow-y-auto"
      style={{ width: 224, borderLeft: `1px solid ${G}1a` }}
    >
      <div className="rounded-xl p-3 space-y-2.5" style={{ background: `${G}09`, border: `1px solid ${G}1e` }}>
        <p className="text-[9px] tracking-[0.25em] uppercase mb-1" style={{ color: GD }}>ステータス</p>
        <StatusRow Icon={Activity}    label="オンライン"  color="#4ade80" glow />
        <StatusRow Icon={Mic}         label={isSession ? (isStandby ? 'スタンバイ' : 'セッション中') : '音声待機中'} color={isSession ? GB : G} />
        <StatusRow Icon={CheckCircle} label="利用可能"   color={G} />
      </div>

      <div className="rounded-xl p-3 space-y-2.5" style={{ background: `${G}09`, border: `1px solid ${G}1e` }}>
        <p className="text-[9px] tracking-[0.25em] uppercase" style={{ color: GD }}>
          {VOICE_ASSISTANT_NAME}メモリ
        </p>
        <p className="text-[9px] text-right" style={{ color: GD }}>今日のサマリー</p>
        <div className="space-y-1.5 mt-1">
          <MemoryRow Icon={Clock}       label="案件進行" value={memory.jobs} />
          <MemoryRow Icon={CheckCircle} label="完了"     value={memory.completed} />
          <MemoryRow Icon={Bell}        label="通知"     value={memory.notifications} />
        </div>
      </div>

      <div className="rounded-xl p-3 space-y-1.5" style={{ background: `${G}09`, border: `1px solid ${G}1e` }}>
        <p className="text-[9px] tracking-[0.25em] uppercase mb-2" style={{ color: GD }}>クイックコマンド</p>
        {QUICK_COMMANDS.map(({ label, utterance, Icon }) => (
          <button
            key={label}
            onClick={() => handleQuick(utterance)}
            disabled={isActive || isProc}
            className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 active:scale-95 disabled:opacity-40"
            style={{ background: `${G}08`, border: `1px solid ${G}1e`, color: 'oklch(0.70 0.008 75)' }}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-3 w-3 shrink-0" style={{ color: G }} />
              {label}
            </span>
            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: GD }} />
          </button>
        ))}
      </div>
    </aside>
  )

  return (
    <div
      className="relative flex flex-col"
      style={{ background: 'oklch(0.04 0.002 260)', minHeight: '100dvh' }}
    >
      {/* Voice Settings Overlay */}
      {showVoiceSettings && (
        <VoiceSettingsPanel
          settings={voiceSettings}
          onClose={() => setShowVoiceSettings(false)}
          onSave={setVoiceSettings}
        />
      )}

      {/* Header */}
      <header
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${G}20` }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full shrink-0" style={{ background: '#4ade80', boxShadow: '0 0 6px #4ade80' }} />
          <span className="text-xs font-bold tracking-[0.22em] uppercase" style={{ color: 'oklch(0.72 0.009 75)' }}>
            AI ENGINE
          </span>
          <span className="text-xs tabular-nums" style={{ color: GD }}><LiveClock /></span>
        </div>
        <div className="flex items-center gap-3">
          {isSession ? (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{ background: `${G}28`, border: `1px solid ${G}`, color: GB, boxShadow: `0 0 12px ${G}50` }}
            >
              <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: isStandby ? GD : '#4ade80' }} />
              {isStandby ? 'スタンバイ' : '会話中'}
            </div>
          ) : (
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.15em] uppercase"
              style={{ background: `${G}16`, border: `1px solid ${G}38`, color: GB }}
            >
              <div className="h-1.5 w-1.5 rounded-full" style={{ background: GB }} />
              {VOICE_ASSISTANT_NAME}モード
            </div>
          )}
          <VoiceWave active={isActive || isSpeak} />
          <button
            onClick={() => setShowVoiceSettings(p => !p)}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{ color: GD }}
            aria-label="音声設定"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={() => router.push('/home')}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{ color: GD }}
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden">
        {LeftPanel}

        <main className="flex flex-1 flex-col items-center overflow-y-auto px-4 pt-8 pb-6 gap-6">
          <div
            className="relative flex items-center justify-center shrink-0"
            style={{ width: 'min(380px, calc(100vw - 2rem))', height: 'min(380px, calc(100vw - 2rem))' }}
          >
            <HikaruCoreSized mode={mode} />
          </div>

          {/* Voice response panel */}
          <div
            className="w-full max-w-md rounded-xl px-5 py-4 text-center"
            style={{ background: `${G}09`, border: `1px solid ${G}1a` }}
          >
            <p
              className="text-base leading-relaxed"
              style={{ color: isError ? 'oklch(0.78 0.24 22)' : isStandby ? GD : 'oklch(0.82 0.009 75)' }}
            >
              {statusSub}
            </p>
            {(isActive || isSpeak) && (
              <div className="flex justify-center mt-3"><VoiceWave active /></div>
            )}
          </div>

          {/* Conversation log */}
          {messages.length > 0 && (
            <div className="w-full max-w-md space-y-2">
              {messages.slice(-6).map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[82%] rounded-xl px-4 py-2.5 text-sm leading-relaxed"
                    style={msg.role === 'user'
                      ? { background: `${G}1e`, border: `1px solid ${G}38`, color: GB }
                      : { background: 'oklch(0.09 0.004 260)', border: '1px solid oklch(0.14 0.003 260)', color: 'oklch(0.82 0.008 75)' }
                    }
                  >
                    <p className="text-[8px] tracking-[0.22em] uppercase mb-1" style={{ color: GD }}>
                      {msg.role === 'user' ? 'YOU' : VOICE_ASSISTANT_NAME}
                    </p>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Mobile: mic + session buttons */}
          <div className="md:hidden flex flex-col items-center gap-3 mt-2">
            <button
              onClick={handleMicClick}
              disabled={isProc || isSession}
              className="flex h-20 w-20 items-center justify-center rounded-full transition-all duration-200 active:scale-90 disabled:opacity-40"
              style={{
                background: isActive ? 'oklch(0.62 0.24 22)' : `linear-gradient(135deg, ${G}, ${GB})`,
                boxShadow: isActive ? '0 0 30px oklch(0.62 0.24 22 / 0.5)' : `0 0 30px ${G}55`,
              }}
              aria-label={isActive ? '停止' : `${VOICE_ASSISTANT_NAME}に話す`}
            >
              {isActive ? <MicOff className="h-8 w-8 text-white" /> : <Mic className="h-8 w-8" style={{ color: 'oklch(0.06 0.003 260)' }} />}
            </button>
            <span className="text-xs" style={{ color: GD }}>{isActive ? '停止するにはタップ' : '1回話す'}</span>
            <button
              onClick={handleSessionToggle}
              disabled={isProc}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: isSession ? `${G}20` : `${G}10`,
                border: `1px solid ${isSession ? G : `${G}30`}`,
                color: isSession ? GB : GD,
                boxShadow: isSession ? `0 0 14px ${G}40` : 'none',
              }}
            >
              <Radio className="h-4 w-4" />
              {isSession ? '会話終了' : 'ハンズフリー開始'}
            </button>
            <button
              onClick={() => setShowVoiceSettings(true)}
              className="flex items-center gap-2 text-xs"
              style={{ color: GD }}
            >
              <Settings className="h-3 w-3" />
              音声設定
            </button>
          </div>

          {/* Mobile: quick commands */}
          <div className="lg:hidden w-full max-w-md">
            <p className="text-[9px] tracking-[0.3em] uppercase mb-2" style={{ color: GD }}>QUICK COMMANDS</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_COMMANDS.map(({ label, utterance, Icon }) => (
                <button
                  key={label}
                  onClick={() => handleQuick(utterance)}
                  disabled={isActive || isProc}
                  className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all active:scale-95 disabled:opacity-40"
                  style={{ background: `${G}10`, border: `1px solid ${G}30`, color: 'oklch(0.72 0.009 75)' }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: G }} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {!isSpeechSupported && (
            <p className="text-xs text-center" style={{ color: 'oklch(0.50 0.007 75)' }}>
              このブラウザでは音声入力を利用できません。Chrome または Safari をお使いください。
            </p>
          )}
        </main>

        {RightPanel}
      </div>
    </div>
  )
}

// ─── Responsive HikaruCore wrapper ───────────────────────────
import type { VoiceMode } from '@/lib/voice/state/types'

function HikaruCoreSized({ mode }: { mode: VoiceMode }) {
  const ref  = React.useRef<HTMLDivElement>(null)
  const [sz, setSz] = React.useState(300)

  React.useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => {
      const s = Math.floor(Math.min(entry.contentRect.width, entry.contentRect.height))
      setSz(s > 0 ? s : 300)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={ref} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <HikaruCore mode={mode} size={sz} />
    </div>
  )
}

// ─── Page entry ──────────────────────────────────────────────
export default function AssistantPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center" style={{ background: 'oklch(0.04 0.002 260)' }}>
          <div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: G }} />
        </div>
      }
    >
      <AssistantPageContent />
    </React.Suspense>
  )
}
