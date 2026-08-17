'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  generateReport, loadReportHistory, loadReport,
  getScoreColor, getScoreLabel,
  type ReportContent, type ReportListItem,
} from '@/services/report.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { calcWorkDuration, formatDateTime, formatDate } from '@/modules/report-ai'
import { cn, toast } from '@hikaru/ui'
import {
  FileText, Download, Printer, RefreshCw, Clock, Star,
  CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Sparkles, History,
} from 'lucide-react'

// ============================================================
// 印刷／PDF スタイル（<head>に注入）
// ============================================================

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  .report-container { padding: 0 !important; }
  .report-page {
    box-shadow: none !important;
    border-radius: 0 !important;
    max-width: none !important;
  }
  @page {
    size: A4;
    margin: 15mm 15mm 20mm 15mm;
  }
  .spot-card { page-break-inside: avoid; }
  .section-header { page-break-after: avoid; }
}
`

// ============================================================
// 報告書コンポーネント
// ============================================================

function RecommendationBadge({ rec }: { rec: 'pass' | 'check' | 'redo' | null }) {
  if (!rec) return null
  const cfg = {
    pass:  { label: '合格',      cls: 'bg-[var(--color-success-muted)] text-[var(--color-success-foreground)] border border-[var(--color-success)]/30' },
    check: { label: '要確認',    cls: 'bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)] border border-[var(--color-warning)]/30' },
    redo:  { label: '再清掃推奨', cls: 'bg-[var(--color-error-muted)]   text-[var(--color-error-foreground)]   border border-[var(--color-error)]/30' },
  }[rec]
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

function ScoreCircle({ score }: { score: number | null }) {
  const color = getScoreColor(score)
  return (
    <div className={cn(
      'flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 font-bold shrink-0',
      score != null && score >= 75 ? 'border-[var(--color-success)] bg-[var(--color-success-muted)]' :
      score != null && score >= 60 ? 'border-[var(--color-warning)] bg-[var(--color-warning-muted)]' :
      score != null               ? 'border-[var(--color-error)] bg-[var(--color-error-muted)]' :
                                    'border-[var(--color-border)] bg-[var(--color-muted)]',
      color
    )}>
      <span className="text-xl leading-none">{score ?? '—'}</span>
      {score != null && <span className="text-[9px] opacity-70">点</span>}
    </div>
  )
}

// ============================================================
// 報告書本体
// ============================================================

function ReportDocument({ content, reportVersion, reportDate }: {
  content: ReportContent
  reportVersion: number
  reportDate: string
}) {
  const { project, store, client, job, spots, summary } = content

  return (
    <div className="report-page bg-white max-w-[800px] mx-auto shadow-[var(--shadow-xl)] print:shadow-none [--color-foreground:#111827] [--color-muted-foreground:#6B7280] [--color-border:#E5E7EB] [--color-muted:#F3F4F6]">
      {/* ===== ヘッダー ===== */}
      <div className="bg-[var(--color-primary)] text-white px-8 py-6 print:px-6 print:py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium opacity-70 tracking-widest uppercase">HIKARU Quality Report</p>
            <h1 className="text-2xl font-bold mt-1">清掃品質報告書</h1>
          </div>
          <div className="text-right text-sm opacity-80">
            <p>No. {reportVersion.toString().padStart(3, '0')}</p>
            <p>{new Date(reportDate).toLocaleDateString('ja-JP')}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-7 print:px-6 print:py-5 print:space-y-5">

        {/* ===== 概要テーブル ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            作業概要
          </h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ['案件名',    project.name],
                ['クライアント', client.name],
                ['店舗名',    store.name],
                ['作業場所',  store.name ?? '—'],
                ['担当者',    job.worker_name],
                ['作業日',    formatDate(job.work_date)],
                ['開始時刻',  formatDateTime(job.started_at)],
                ['終了時刻',  job.completed_at ? formatDateTime(job.completed_at) : '—'],
                ['作業時間',  calcWorkDuration(job.started_at, job.completed_at)],
              ].map(([label, value]) => (
                <tr key={label} className="border-b border-[var(--color-border)]/50">
                  <td className="py-2 pr-4 w-32 text-[var(--color-muted-foreground)] font-medium">{label}</td>
                  <td className="py-2 font-medium text-[var(--color-foreground)]">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ===== 品質スコアサマリー ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            品質評価サマリー
          </h2>
          <div className="flex items-center gap-6 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-4">
            <ScoreCircle score={summary.overall_score} />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className={cn('text-4xl font-bold', getScoreColor(summary.overall_score))}>
                  {summary.overall_score}
                </span>
                <span className="text-lg text-[var(--color-muted-foreground)]">/ 100点</span>
                <span className={cn('text-sm font-semibold ml-2', getScoreColor(summary.overall_score))}>
                  {getScoreLabel(summary.overall_score)}
                </span>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-[var(--color-muted-foreground)]">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-success)]" />
                  合格: {summary.passed_count}箇所
                </span>
                {summary.check_count > 0 && (
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                    要確認: {summary.check_count}箇所
                  </span>
                )}
                {summary.redo_count > 0 && (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-[var(--color-error)]" />
                    再清掃: {summary.redo_count}箇所
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ===== AI作業内容要約 ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            本日の作業内容
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.work_summary}</p>
        </section>

        {/* ===== 品質評価総括 ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            品質評価
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.quality_assessment}</p>
        </section>

        {/* ===== 箇所別詳細 ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-1.5">
            撮影箇所別詳細 （{spots.length}箇所）
          </h2>
          <div className="space-y-5">
            {spots.map((spot) => (
              <div key={spot.name} className="spot-card border border-[var(--color-border)] rounded-[var(--radius-xl)] overflow-hidden">
                {/* スポットヘッダー */}
                <div className="flex items-center justify-between bg-[var(--color-muted)]/40 px-4 py-2.5 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold shrink-0">
                      {spot.order}
                    </span>
                    <h3 className="font-bold text-base text-[var(--color-foreground)]">{spot.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {spot.score != null && (
                      <span className={cn('text-sm font-bold', getScoreColor(spot.score))}>
                        {spot.score}点
                      </span>
                    )}
                    <RecommendationBadge rec={spot.recommendation} />
                  </div>
                </div>

                <div className="px-4 py-4 space-y-3">
                  {/* Before / After 写真 */}
                  {(spot.before_url || spot.after_url) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Before（清掃前）</p>
                        {spot.before_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={spot.before_url}
                            alt={`${spot.name} Before`}
                            className="w-full aspect-[4/3] object-cover rounded-[var(--radius-lg)] border border-[var(--color-border)]"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-[var(--color-muted)] rounded-[var(--radius-lg)] flex items-center justify-center">
                            <p className="text-xs text-[var(--color-muted-foreground)]">写真なし</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[var(--color-success-foreground)] uppercase tracking-wide">After（清掃後）</p>
                        {spot.after_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={spot.after_url}
                            alt={`${spot.name} After`}
                            className="w-full aspect-[4/3] object-cover rounded-[var(--radius-lg)] border border-[var(--color-border)]"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-[var(--color-muted)] rounded-[var(--radius-lg)] flex items-center justify-center">
                            <p className="text-xs text-[var(--color-muted-foreground)]">写真なし</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AIコメント */}
                  {spot.ai_comment && (
                    <div className="rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-[var(--color-primary)] mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AIコメント
                      </p>
                      <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{spot.ai_comment}</p>
                    </div>
                  )}

                  {/* 改善提案 */}
                  {spot.improvements.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[var(--color-muted-foreground)] mb-1">改善提案</p>
                      <ul className="space-y-0.5">
                        {spot.improvements.map((imp, i) => (
                          <li key={i} className="text-xs text-[var(--color-foreground)] flex items-start gap-1">
                            <span className="text-[var(--color-warning)] mt-0.5 shrink-0">•</span>
                            {imp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== 総合評価 ===== */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            総合評価
          </h2>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-4 space-y-3">
            <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.total_comment}</p>
            {summary.next_recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-muted-foreground)] mb-2">次回作業への推奨事項</p>
                <ul className="space-y-1">
                  {summary.next_recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-[var(--color-foreground)] flex items-start gap-1.5">
                      <span className="text-[var(--color-primary)] mt-0.5">→</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {/* ===== フッター ===== */}
        <footer className="border-t border-[var(--color-border)] pt-4 mt-6 flex items-center justify-between">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <p className="font-semibold text-[var(--color-primary)]">HIKARU 清掃品質管理システム</p>
            <p>生成日時: {new Date(content.generated_at).toLocaleString('ja-JP')}</p>
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)] text-right">
            <p>担当: {job.worker_name}</p>
            <p>Ver.{reportVersion}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ============================================================
// 報告書履歴リスト
// ============================================================

function HistoryPanel({
  history,
  onSelect,
  selectedId,
}: {
  history: ReportListItem[]
  onSelect: (id: string) => void
  selectedId?: string
}) {
  const [open, setOpen] = React.useState(false)

  if (history.length === 0) return null

  return (
    <div className="no-print rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <span className="text-sm font-medium">報告書履歴（{history.length}件）</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
          {history.map((h) => (
            <button
              key={h.id}
              onClick={() => onSelect(h.id)}
              className={cn(
                'w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-colors',
                selectedId === h.id ? 'bg-[var(--color-primary-muted)]' : 'hover:bg-[var(--color-muted)]'
              )}
            >
              <span className="text-[var(--color-muted-foreground)]">
                Ver.{h.version} — {new Date(h.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
              {h.overall_score != null && (
                <span className={cn('font-semibold', getScoreColor(h.overall_score))}>
                  {h.overall_score}点
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function ReportPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const router = useRouter()

  const [jobId, setJobId]           = React.useState<string | null>(null)
  const [content, setContent]       = React.useState<ReportContent | null>(null)
  const [reportId, setReportId]     = React.useState<string | undefined>()
  const [reportDate, setReportDate] = React.useState<string>('')
  const [reportVersion, setReportVersion] = React.useState(1)
  const [history, setHistory]       = React.useState<ReportListItem[]>([])
  const [loading, setLoading]       = React.useState(true)
  const [generating, setGenerating] = React.useState(false)

  React.useEffect(() => {
    async function init() {
      try {
        // ブラウザSupabase auth.getUser() ハングを回避するサーバーAPI経由でtodayJob取得
        const res = await fetch(`/api/jobs/${projectId}`, {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) { router.push(`/jobs/${projectId}`); return }
        const { todayJob } = await res.json()
        if (!todayJob) { router.push(`/jobs/${projectId}`); return }
        setJobId(todayJob.id)

        const hist = await loadReportHistory(todayJob.id)
        setHistory(hist)

        // 最新の報告書があれば表示
        if (hist.length > 0) {
          const latest = hist[0]
          const report = await loadReport(latest.id)
          if (report) {
            setContent(report.content)
            setReportId(latest.id)
            setReportDate(report.created_at)
            setReportVersion(report.version)
          }
        }
      } catch {
        router.push(`/jobs/${projectId}`)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [projectId, router])

  async function handleGenerate() {
    if (!jobId) return
    setGenerating(true)
    try {
      const result = await generateReport(jobId)
      if (result.success && result.content) {
        setContent(result.content)
        setReportId(result.reportId)
        setReportDate(new Date().toISOString())
        setReportVersion(result.content.summary ? (history.length + 1) : 1)
        const hist = await loadReportHistory(jobId)
        setHistory(hist)
        toast.success('報告書を生成しました')
      } else {
        toast.error(`生成に失敗しました: ${result.error}`)
      }
    } catch {
      toast.error('生成に失敗しました')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSelectHistory(id: string) {
    const report = await loadReport(id)
    if (report) {
      setContent(report.content)
      setReportId(id)
      setReportDate(report.created_at)
      setReportVersion(report.version)
    }
  }

  function handlePrint() {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="報告書" showBack />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <>
      {/* print styles */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <div className="min-h-dvh bg-[var(--color-background)]">
        {/* ツールバー */}
        <div className="no-print sticky top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between px-4 h-[var(--header-height)]">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              ← 戻る
            </button>
            <h1 className="text-base font-semibold">報告書</h1>
            <div className="flex gap-2">
              {content && (
                <>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-1.5 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-xs font-medium text-[var(--color-foreground)] active:bg-[var(--color-border)] transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" /> 印刷/PDF
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-1.5 rounded-[var(--radius-lg)] bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white active:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> 再生成
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="report-container px-4 py-4 space-y-4 pb-24">
          {/* 履歴 */}
          {history.length > 0 && (
            <HistoryPanel
              history={history}
              onSelect={handleSelectHistory}
              selectedId={reportId}
            />
          )}

          {/* 生成中 */}
          {generating && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin mb-4" />
              <p className="text-base font-semibold">AI報告書を生成中...</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                評価データを分析し、コメントを作成しています
              </p>
            </div>
          )}

          {/* 報告書なし */}
          {!generating && !content && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FileText className="h-16 w-16 text-[var(--color-muted-foreground)] opacity-30 mb-4" />
              <p className="text-base font-semibold text-[var(--color-foreground)]">報告書がありません</p>
              <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                AI品質評価完了後に報告書を生成できます
              </p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className={cn(
                  'mt-6 flex items-center gap-2 rounded-[var(--radius-xl)] px-6 py-3.5',
                  'bg-[var(--color-primary)] text-white text-base font-semibold',
                  'active:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50'
                )}
              >
                <Sparkles className="h-5 w-5" />
                AI報告書を生成する
              </button>
            </div>
          )}

          {/* 報告書プレビュー */}
          {!generating && content && (
            <>
              {/* ダウンロードボタン（モバイル向け） */}
              <div className="no-print flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] py-3.5 text-sm font-semibold text-[var(--color-foreground)] bg-[var(--color-surface)] active:bg-[var(--color-muted)] transition-colors"
                >
                  <Download className="h-4.5 w-4.5" /> PDFダウンロード
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-xl)] border border-[var(--color-border)] py-3.5 text-sm font-semibold text-[var(--color-foreground)] bg-[var(--color-surface)] active:bg-[var(--color-muted)] transition-colors"
                >
                  <Printer className="h-4.5 w-4.5" /> 印刷
                </button>
              </div>

              {/* 報告書本体 */}
              <ReportDocument
                content={content}
                reportVersion={reportVersion}
                reportDate={reportDate}
              />
            </>
          )}
        </div>
      </div>
    </>
  )
}
