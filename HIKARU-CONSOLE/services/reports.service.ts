import { createClient } from '@/lib/supabase/client'

// ============================================================
// 報告書サービス — CONSOLE用
// ============================================================

export interface ReportListItem {
  id: string
  job_id: string
  project_id: string
  worker_id: string
  version: number
  overall_score: number | null
  created_at: string
  jobs: {
    work_date: string
    started_at: string
    completed_at: string | null
  } | null
  projects: {
    name: string
    code: string | null
    stores: { name: string; address: string | null } | null
  } | null
  profiles: { name: string } | null
}

export interface ReportSpot {
  name: string
  order: number
  score: number | null
  recommendation: 'pass' | 'check' | 'redo' | null
  before_url: string | null
  after_url: string | null
  ai_comment: string
  improvements: string[]
  remaining_issues: string[]
  comparison: string | null
}

export interface ReportContent {
  project: {
    name: string
    code: string | null
    address: string | null
    assigned_to: string | null
    notes: string | null
  }
  store: {
    name: string
    address: string | null
    phone: string | null
  }
  client: { name: string }
  job: {
    work_date: string
    started_at: string
    completed_at: string | null
    worker_name: string
  }
  spots: ReportSpot[]
  summary: {
    overall_score: number
    passed_count: number
    check_count: number
    redo_count: number
    total_spots: number
    work_summary: string
    quality_assessment: string
    total_comment: string
    next_recommendations: string[]
  }
  generated_at: string
  version: number
}

export interface ReportDetail {
  id: string
  job_id: string
  project_id: string
  worker_id: string
  version: number
  overall_score: number | null
  content: ReportContent
  pdf_url: string | null
  created_at: string
}

export async function listReports(opts?: {
  search?: string
  page?: number
  pageSize?: number
  dateFrom?: string
  dateTo?: string
}): Promise<{ data: ReportListItem[]; count: number; error: Error | null }> {
  const supabase = createClient()
  const page     = opts?.page     ?? 1
  const pageSize = opts?.pageSize ?? 20

  let query = supabase
    .from('reports')
    .select(
      `id, job_id, project_id, worker_id, version, overall_score, created_at,
       jobs(work_date, started_at, completed_at),
       projects(name, code, stores(name, address)),
       profiles(name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  // Note: Supabaseのクライアントライブラリは関連テーブルへのOR検索を未サポート
  // 将来: Supabase RPC または全文検索 (pg_trgm) を利用して実装予定
  if (opts?.dateFrom) {
    query = query.gte('created_at', opts.dateFrom)
  }
  if (opts?.dateTo) {
    query = query.lte('created_at', opts.dateTo + 'T23:59:59Z')
  }

  const { data, count, error } = await query

  return {
    data:  (data ?? []) as unknown as ReportListItem[],
    count: count ?? 0,
    error: error ? new Error(error.message) : null,
  }
}

export async function getReport(id: string): Promise<{ data: ReportDetail | null; error: Error | null }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single()

  return {
    data:  data as ReportDetail | null,
    error: error ? new Error(error.message) : null,
  }
}

export async function getReportStats(): Promise<{
  totalReports: number
  avgScore: number | null
  thisMonthCount: number
}> {
  const supabase = createClient()
  const now  = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: all }, { data: monthly }] = await Promise.all([
    supabase.from('reports').select('overall_score'),
    supabase.from('reports').select('id').gte('created_at', from),
  ])

  const scores  = (all ?? []).map((r: any) => r.overall_score).filter((s: any) => s != null) as number[]
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null

  return {
    totalReports:   all?.length   ?? 0,
    avgScore,
    thisMonthCount: monthly?.length ?? 0,
  }
}
