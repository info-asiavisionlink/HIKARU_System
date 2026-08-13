import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { REPORT_GENERATION_PROMPT, type SpotInput } from './prompts'

// ============================================================
// 報告書コンテンツ型定義
// ============================================================

export interface ReportSpot {
  name: string
  order: number
  score: number | null
  recommendation: 'pass' | 'check' | 'redo' | null
  before_url: string | null
  after_url: string | null
  comparison: string | null
  ai_comment: string   // AI生成コメント
  improvements: string[]
  remaining_issues: string[]
}

export interface ReportSummary {
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

export interface ReportContent {
  project: {
    name: string
    code: string | null
    notes: string | null
  }
  store: {
    name: string
    phone: string | null
  }
  client: {
    name: string
  }
  job: {
    work_date: string
    started_at: string
    completed_at: string | null
    worker_name: string
  }
  spots: ReportSpot[]
  summary: ReportSummary
  generated_at: string
  version: number
}

// ============================================================
// AI報告書コンテンツ生成
// ============================================================

interface GenerateParams {
  storeName: string
  clientName: string
  workDate: string
  workerName: string
  spots: SpotInput[]
  overallScore: number
}

export async function generateReportContent(params: GenerateParams): Promise<{
  work_summary: string
  quality_assessment: string
  spot_comments: Record<string, string>
  total_comment: string
  next_recommendations: string[]
}> {
  const openai = createOpenAIClient()

  // timeout must be shorter than Server maxDuration(90s) so we can return a JSON error before Vercel kills the function
  const response = await openai.chat.completions.create(
    {
      model: OPENAI_MODELS.REPORT,
      messages: [
        {
          role: 'user',
          content: REPORT_GENERATION_PROMPT(
            params.storeName,
            params.clientName,
            params.workDate,
            params.workerName,
            params.spots,
            params.overallScore
          ),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 2000,
    },
    { timeout: 60_000 },
  )

  const raw = response.choices[0]?.message.content ?? '{}'
  const parsed = JSON.parse(raw)

  return {
    work_summary:         parsed.work_summary         ?? '清掃作業を実施しました。',
    quality_assessment:   parsed.quality_assessment   ?? '品質評価を実施しました。',
    spot_comments:        parsed.spot_comments        ?? {},
    total_comment:        parsed.total_comment        ?? '全体的に清掃基準を満たしています。',
    next_recommendations: parsed.next_recommendations ?? [],
  }
}

// ============================================================
// 作業時間計算ユーティリティ
// ============================================================

export function calcWorkDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const start = new Date(startedAt).getTime()
  const end   = new Date(completedAt).getTime()
  const diff  = Math.round((end - start) / 60000) // 分

  if (diff < 60) return `${diff}分`
  const h = Math.floor(diff / 60)
  const m = diff % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}
