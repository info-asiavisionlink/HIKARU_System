// ============================================================
// JARVIS Voice Audit Logger
// DB migration なし。構造化ログでVercel Logsへ出力。
// 機密情報（会話全文・個人データ）は含めない。
// ============================================================

export type AuditResult = 'success' | 'failed' | 'rejected' | 'cancelled'
export type AuditSource = 'jarvis_voice' | 'jarvis_realtime'

export interface VoiceAuditLog {
  type:         'jarvis_audit'
  source:       AuditSource
  actor:        string   // worker_id or admin_id
  actorType:    'worker' | 'admin'
  companyId?:   string
  action:       string
  resourceType?: string
  resourceId?:   string
  safetyLevel:  number
  confirmed:    boolean
  result:       AuditResult
  reason?:      string
  timestamp:    string
}

/** 音声アクション監査ログ出力 */
export function logVoiceAudit(entry: Omit<VoiceAuditLog, 'type' | 'timestamp'>): void {
  const log: VoiceAuditLog = {
    type:      'jarvis_audit',
    timestamp: new Date().toISOString(),
    ...entry,
  }
  // Vercel Log にJSONで出力（Logsから検索可能）
  console.log(JSON.stringify(log))
}
