// ============================================================
// Voice Assistant — 状態型定義
// V1: L0-L2 Actions のみ。pendingAction/handsFree/formSession は将来実装。
// ============================================================

export type VoiceMode =
  | 'idle'        // 待機
  | 'listening'   // 音声認識中
  | 'processing'  // Intent解析中
  | 'speaking'    // TTS読み上げ中
  | 'error'       // エラー状態

export type ContextType =
  | 'home'
  | 'job'
  | 'chat'
  | 'manual'
  | 'before'
  | 'after'
  | 'evaluation'
  | 'schedule'
  | 'attendance'
  | 'expenses'
  | 'notifications'
  | 'profile'
  | 'other'

export interface VoiceMessage {
  role:      'user' | 'assistant'
  text:      string
  timestamp: number
}

// VoiceButton内のローカル状態（サーバー保存なし）
export interface VoiceState {
  mode:                VoiceMode
  currentPath:         string
  contextType:         ContextType
  currentResourceId?:  string    // /jobs/[id] の id（= projectId）
  lastUserUtterance?:  string
  lastQuerySummary?:   string    // L1取得結果のサマリ（フォローアップ用）
  recentMessages:      VoiceMessage[]
  errorMessage?:       string
}
