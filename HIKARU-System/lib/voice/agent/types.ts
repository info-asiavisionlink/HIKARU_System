// ============================================================
// JARVIS Agent — 型定義（System専用）
// CONSOLEとは完全分離。
// ============================================================

/** Agentが1ターンで利用できるContext */
export interface SystemAgentContext {
  /** 認証済みWorker ID（API Route で検証済み・client body から取らない）*/
  workerId:     string
  currentPath:  string
  projectId?:   string  // URL から自動抽出
  /** 既存API呼び出し用Cookieヘッダー（認証転送） */
  cookieHeader: string
  /** self-call base URL */
  baseUrl:      string
}

/** Tool実行結果 */
export interface ToolResult {
  success: boolean
  /** LLMへ返すテキストサマリー */
  text:    string
  /** pendingChoiceに使用するリスト（ある場合） */
  items?:  Array<{ id: string; label: string }>
  /** raw data（必要に応じてAgentが参照） */
  data?:   Record<string, unknown>
}

/** System Tool定義 */
export interface SystemAgentTool {
  name:        string
  description: string
  safetyLevel: 0 | 1 | 2  // 3以上は登録しない
  parameters: {
    type:       'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?:  string[]
  }
  execute(params: Record<string, string>, ctx: SystemAgentContext): Promise<ToolResult>
}

/** Agent APIのレスポンス（既存Intent APIと同形式・後方互換） */
export interface AgentApiResponse {
  action:      string | null   // system.xxx または null
  confidence:  number
  params:      Record<string, string>
  voiceReply:  string | null
  /** Agent が収集したリスト（lastResultData更新用） */
  resultData?: {
    type:   'job_list' | 'manual_list' | 'notification_list' | 'schedule_list' | 'single' | 'none'
    items?: Array<{ id: string; label: string }>
    summary?: string
  }
}
