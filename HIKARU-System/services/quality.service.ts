// ============================================================
// 品質評価サービス — クライアントサイド専用
// ============================================================

export interface EvaluationRow {
  id: string
  job_id: string
  spot_id: string
  score: number
  dirty_removal: number | null
  thoroughness: number | null
  shine: number | null
  passed: boolean
  recommendation: 'pass' | 'check' | 'redo'
  before_summary: string | null
  after_summary: string | null
  comparison: string | null
  comment: string
  improvements: string[] | null
  remaining_issues: string[] | null
  photo_quality_ok: boolean
  photo_quality_issues: string[] | null
  created_at: string
  photo_spots?: { name: string; is_required: boolean }
  fresh?: boolean  // 現在の写真と評価時の写真が一致するか (QUALITY-FRESH)
}

export interface EvaluationSummary {
  total: number
  evaluated: number
  passed: number
  failed: number
  averageScore: number
  allPassed: boolean
}

// 全スポットを一括評価
export async function evaluateAllSpots(jobId: string): Promise<{
  success: boolean
  summary?: EvaluationSummary
  results?: any[]
  error?: string
}> {
  const res = await fetch('/api/ai/quality', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'evaluate-all', jobId }),
  })

  const json = await res.json()
  if (!json.success) return { success: false, error: json.error?.message }
  return { success: true, summary: json.data.summary, results: json.data.results }
}

// 単一スポット評価
export async function evaluateSpot(params: {
  jobId: string
  spotId: string
  beforeUrl: string
  afterUrl: string
  beforePhotoId?: string
  afterPhotoId?: string
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await fetch('/api/ai/quality', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'evaluate', ...params }),
  })

  const json = await res.json()
  if (!json.success) return { success: false, error: json.error?.message }
  return { success: true, data: json.data }
}

// 評価結果取得
export async function loadEvaluations(jobId: string): Promise<EvaluationRow[]> {
  const res = await fetch(`/api/ai/quality?jobId=${jobId}`)
  if (!res.ok) return []
  const json = await res.json()
  return json.success ? json.data : []
}

// スコアから表示データを生成
export function getScoreInfo(score: number) {
  if (score >= 90) return { stars: 5, label: '素晴らしい',  colorClass: 'text-[var(--color-success)]',  bgClass: 'bg-[var(--color-success-muted)]'  }
  if (score >= 75) return { stars: 4, label: '良好',       colorClass: 'text-[var(--color-success)]',  bgClass: 'bg-[var(--color-success-muted)]'  }
  if (score >= 60) return { stars: 3, label: '普通',       colorClass: 'text-[var(--color-warning)]',  bgClass: 'bg-[var(--color-warning-muted)]'  }
  if (score >= 45) return { stars: 2, label: '要改善',     colorClass: 'text-[var(--color-warning)]',  bgClass: 'bg-[var(--color-warning-muted)]'  }
  return              { stars: 1, label: '不合格',      colorClass: 'text-[var(--color-error)]',    bgClass: 'bg-[var(--color-error-muted)]'    }
}

export const RECOMMENDATION_CONFIG = {
  pass:  { label: '合格',     variant: 'success' as const, emoji: '✅' },
  check: { label: '要確認',   variant: 'warning' as const, emoji: '⚠️' },
  redo:  { label: '再清掃推奨', variant: 'error'  as const, emoji: '🔄' },
}
