// ============================================================
// 報告書サービス — クライアントサイド専用
// ============================================================

import type { ReportContent } from '@/modules/report-ai'

export type { ReportContent } from '@/modules/report-ai'

export interface ReportListItem {
  id: string
  version: number
  overall_score: number | null
  created_at: string
}

// 報告書生成（API経由）
export async function generateReport(jobId: string): Promise<{
  success: boolean
  reportId?: string
  content?: ReportContent
  error?: string
}> {
  const res = await fetch('/api/ai/report', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jobId }),
  })

  const json = await res.json()
  if (!json.success) return { success: false, error: json.error?.message }
  return { success: true, reportId: json.data.reportId, content: json.data.content }
}

// 報告書履歴取得
export async function loadReportHistory(jobId: string): Promise<ReportListItem[]> {
  const res = await fetch(`/api/ai/report?jobId=${jobId}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

// 特定報告書取得
export async function loadReport(reportId: string): Promise<{ content: ReportContent; version: number; created_at: string } | null> {
  const res = await fetch(`/api/ai/report?reportId=${reportId}`)
  if (!res.ok) return null
  const json = await res.json()
  if (!json.success) return null
  return { content: json.data.content, version: json.data.version, created_at: json.data.created_at }
}

// スコアに対応する色クラスを返す
export function getScoreColor(score: number | null): string {
  if (score == null) return 'text-[var(--color-muted-foreground)]'
  if (score >= 90) return 'text-[var(--color-success)]'
  if (score >= 75) return 'text-[var(--color-success)]'
  if (score >= 60) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-error)]'
}

export function getScoreLabel(score: number | null): string {
  if (score == null) return '未評価'
  if (score >= 90) return '非常に良好'
  if (score >= 75) return '良好'
  if (score >= 60) return '普通'
  if (score >= 45) return '要改善'
  return '不合格'
}
