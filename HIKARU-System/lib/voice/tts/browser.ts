// ============================================================
// Browser SpeechSynthesis TTS wrapper
// サーバーサイドでは実行しない（typeof window チェック）
// ============================================================

import type { VoiceSettings } from '@/lib/voice/state/types'

export class BrowserTTS {
  speak(text: string, onEnd?: () => void, settings?: VoiceSettings): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    window.speechSynthesis.cancel()
    const utter   = new SpeechSynthesisUtterance(text)
    utter.lang    = 'ja-JP'
    utter.rate    = settings?.rate   ?? 1.0
    utter.pitch   = settings?.pitch  ?? 1.0
    utter.volume  = settings?.volume ?? 1.0

    const voices = window.speechSynthesis.getVoices()
    if (settings?.voiceURI) {
      const found = voices.find(v => v.voiceURI === settings.voiceURI)
      if (found) utter.voice = found
    } else {
      const jpVoice = voices.find(v => v.lang.startsWith('ja'))
      if (jpVoice) utter.voice = jpVoice
    }

    if (onEnd) {
      let called = false
      const fire = () => { if (!called) { called = true; onEnd() } }
      utter.onend   = fire
      utter.onerror = fire
      // Chrome で onend が発火しない場合のフォールバック
      const maxWait = Math.max(4000, text.length * 130)
      setTimeout(fire, maxWait)
    }

    window.speechSynthesis.speak(utter)
  }

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined') return []
    return window.speechSynthesis.getVoices()
  }

  get isSpeaking(): boolean {
    if (typeof window === 'undefined') return false
    return window.speechSynthesis?.speaking ?? false
  }
}

// シングルトンインスタンス（クライアントのみ）
export const browserTTS = new BrowserTTS()
