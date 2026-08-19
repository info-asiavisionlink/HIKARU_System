// ============================================================
// Browser SpeechSynthesis TTS wrapper
// サーバーサイドでは実行しない（typeof window チェック）
// ============================================================

export class BrowserTTS {
  speak(text: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    // 前の読み上げを即座に停止してから開始（Barge-in基本対応）
    window.speechSynthesis.cancel()
    const utter   = new SpeechSynthesisUtterance(text)
    utter.lang    = 'ja-JP'
    utter.rate    = 1.0
    utter.pitch   = 1.0
    utter.volume  = 1.0
    window.speechSynthesis.speak(utter)
  }

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  get isSpeaking(): boolean {
    if (typeof window === 'undefined') return false
    return window.speechSynthesis?.speaking ?? false
  }
}

// シングルトンインスタンス（クライアントのみ）
export const browserTTS = new BrowserTTS()
