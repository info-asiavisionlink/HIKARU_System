// ============================================================
// Browser SpeechSynthesis TTS wrapper
// サーバーサイドでは実行しない（typeof window チェック）
// ============================================================

export class BrowserTTS {
  /**
   * @param onEnd - 読み上げ完了後のコールバック。
   *   Chrome の TTS onend バグ対策として最大待機タイムアウトも設置。
   */
  speak(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.()
      return
    }
    // 前の読み上げを即座に停止してから開始（Barge-in基本対応）
    window.speechSynthesis.cancel()
    const utter   = new SpeechSynthesisUtterance(text)
    utter.lang    = 'ja-JP'
    utter.rate    = 1.0
    utter.pitch   = 1.0
    utter.volume  = 1.0

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

  get isSpeaking(): boolean {
    if (typeof window === 'undefined') return false
    return window.speechSynthesis?.speaking ?? false
  }
}

// シングルトンインスタンス（クライアントのみ）
export const browserTTS = new BrowserTTS()
