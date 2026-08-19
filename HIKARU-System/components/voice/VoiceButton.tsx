'use client'

import * as React from 'react'
import { Mic } from 'lucide-react'
import { VoiceOverlay } from './VoiceOverlay'
import { browserTTS } from '@/lib/voice/tts/browser'
import { useVoiceAssistant } from '@/lib/voice/useVoiceAssistant'

// ============================================================
// VoiceButton — 右下フローティングボタン
// ロジックは useVoiceAssistant hook へ委譲。
// ============================================================

interface VoiceButtonProps {
  projectId?: string
}

export function VoiceButton({ projectId }: VoiceButtonProps) {
  const { mode, errorMessage, isSpeechSupported, startListening, stopAll } = useVoiceAssistant({ projectId })
  const [showOverlay, setShowOverlay] = React.useState(false)

  // modeの変化でOverlay表示制御
  React.useEffect(() => {
    if (mode !== 'idle') {
      setShowOverlay(true)
    } else {
      const t = setTimeout(() => setShowOverlay(false), 400)
      return () => clearTimeout(t)
    }
  }, [mode])

  const handleClick = () => {
    if (mode === 'speaking') { browserTTS.stop(); return }
    if (mode === 'processing') return
    if (mode === 'listening') return
    if (!isSpeechSupported) { setShowOverlay(true) }
    startListening()
    setShowOverlay(true)
  }

  const handleClose = () => { stopAll(); setShowOverlay(false) }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={mode === 'processing'}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all active:scale-90 disabled:opacity-50"
        style={{
          background: mode === 'listening' ? 'var(--color-error)' : 'var(--color-primary)',
          boxShadow:  '0 4px 20px rgba(0,0,0,0.3)',
        }}
        aria-label="HIKARUに話す"
      >
        <Mic className="h-6 w-6 text-white" />
      </button>

      {showOverlay && (
        <VoiceOverlay mode={mode} errorMessage={errorMessage} onClose={handleClose} />
      )}
    </>
  )
}
