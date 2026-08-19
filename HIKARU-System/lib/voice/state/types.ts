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
  currentResourceId?:  string
  lastUserUtterance?:  string
  lastQuerySummary?:   string
  recentMessages:      VoiceMessage[]
  errorMessage?:       string
}

// ─── 自然会話用 Conversation Context ─────────────────────────
// DB保存なし。Sessionスコープのみ。

export interface LastResultItem {
  id:    string
  label: string
}

export interface LastResultData {
  type:    'job_list' | 'notification_list' | 'schedule_list' | 'manual_list' | 'single' | 'none'
  items?:  LastResultItem[]  // 選択肢（「1件目を開いて」などの解決に使用）
  summary?: string
}

export interface PendingConfirmation {
  action:              string
  params:              Record<string, string>
  safetyLevel:         3 | 4 | 5
  message:             string   // ユーザーへの確認文
  resourceType?:       string
  resourceId?:         string
  expiresAt:           number   // Date.now() + expiry
}

export interface ConversationContext {
  lastIntent?:          string
  lastAction?:          string
  lastResultData?:      LastResultData
  // Responses API / Agents SDK セッション継続用
  previousResponseId?:  string
  // Human-in-the-loop: Stateless Confirmation
  pendingConfirmation?: PendingConfirmation
  // 旧 Foundation フラグ（後方互換）
  pendingApproval?:     boolean
  pendingAction?:       string
}

// Voice設定（localStorage保存・Conversationは保存しない）
export interface VoiceSettings {
  voiceURI: string   // '' = browser default
  rate:     number   // 0.5-2.0
  pitch:    number   // 0-2.0
  volume:   number   // 0-1.0
}
