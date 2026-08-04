'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getReport, type ReportContent, type ReportSpot } from '@/services/reports.service'
import { cn } from '@hikaru/ui'
import { Printer, ChevronLeft, CheckCircle2, AlertTriangle, XCircle, Sparkles } from 'lucide-react'

// ============================================================
// 印刷スタイル
// ============================================================

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  body { background: white !important; }
  .report-wrapper { padding: 0 !important; }
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
// スコアカラー
// ============================================================

function getScoreColor(score: number | null): string {
  if (score == null) return 'text-[var(--color-muted-foreground)]'
  if (score >= 75)   return 'text-[var(--color-success)]'
  if (score >= 60)   return 'text-[var(--color-warning)]'
  return 'text-[var(--color-error)]'
}

function getScoreLabel(score: number | null): string {
  if (score == null) return '未評価'
  if (score >= 90)   return '非常に良好'
  if (score >= 75)   return '良好'
  if (score >= 60)   return '普通'
  if (score >= 45)   return '要改善'
  return '不合格'
}

function calcWorkDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—'
  const diff = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000)
  if (diff < 60) return `${diff}分`
  const h = Math.floor(diff / 60), m = diff % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// 推奨バッジ
// ============================================================

function RecBadge({ rec }: { rec: 'pass' | 'check' | 'redo' | null }) {
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

// ============================================================
// スコアサークル
// ============================================================

function ScoreCircle({ score }: { score: number | null }) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center w-16 h-16 rounded-full border-2 font-bold shrink-0',
      score != null && score >= 75 ? 'border-[var(--color-success)] bg-[var(--color-success-muted)]' :
      score != null && score >= 60 ? 'border-[var(--color-warning)] bg-[var(--color-warning-muted)]' :
      score != null               ? 'border-[var(--color-error)] bg-[var(--color-error-muted)]' :
                                    'border-[var(--color-border)] bg-[var(--color-muted)]',
      getScoreColor(score)
    )}>
      <span className="text-xl leading-none">{score ?? '—'}</span>
      {score != null && <span className="text-[9px] opacity-70">点</span>}
    </div>
  )
}

// ============================================================
// 報告書本体
// ============================================================

function ReportDocument({ content, version, createdAt }: {
  content: ReportContent
  version: number
  createdAt: string
}) {
  const { project, store, client, job, spots, summary } = content

  return (
    <div className="report-page bg-white max-w-[800px] mx-auto shadow-[0_4px_24px_rgba(0,0,0,0.1)] print:shadow-none">
      {/* ヘッダー */}
      <div className="bg-[var(--color-primary)] text-white px-8 py-6 print:px-6 print:py-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium opacity-70 tracking-widest uppercase">HIKARU Quality Report</p>
            <h1 className="text-2xl font-bold mt-1">清掃品質報告書</h1>
          </div>
          <div className="text-right text-sm opacity-80">
            <p>No. {version.toString().padStart(3, '0')}</p>
            <p>{new Date(createdAt).toLocaleDateString('ja-JP')}</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-7 print:px-6 print:py-5 print:space-y-5">

        {/* 作業概要テーブル */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            作業概要
          </h2>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {[
                ['案件名',    project.name],
                ['クライアント', client.name],
                ['作業場所',  store.name],
                ['担当者',    job.worker_name],
                ['作業日',    formatDate(job.work_date)],
                ['開始時刻',  formatTime(job.started_at)],
                ['終了時刻',  job.completed_at ? formatTime(job.completed_at) : '—'],
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

        {/* 品質スコアサマリー */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            品質評価サマリー
          </h2>
          <div className="flex items-center gap-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-4">
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

        {/* 作業内容サマリー */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            本日の作業内容
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.work_summary}</p>
        </section>

        {/* 品質評価総括 */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            品質評価
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.quality_assessment}</p>
        </section>

        {/* 箇所別詳細 */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-4 border-b border-[var(--color-border)] pb-1.5">
            撮影箇所別詳細 （{spots.length}箇所）
          </h2>
          <div className="space-y-5">
            {spots.map((spot) => (
              <div key={spot.name} className="spot-card border border-[var(--color-border)] rounded-xl overflow-hidden">
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
                    <RecBadge rec={spot.recommendation} />
                  </div>
                </div>

                <div className="px-4 py-4 space-y-3">
                  {/* Before / After */}
                  {(spot.before_url || spot.after_url) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Before（清掃前）</p>
                        {spot.before_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={spot.before_url}
                            alt={`${spot.name} Before`}
                            className="w-full aspect-[4/3] object-cover rounded-lg border border-[var(--color-border)]"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-[var(--color-muted)] rounded-lg flex items-center justify-center">
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
                            className="w-full aspect-[4/3] object-cover rounded-lg border border-[var(--color-border)]"
                          />
                        ) : (
                          <div className="aspect-[4/3] bg-[var(--color-muted)] rounded-lg flex items-center justify-center">
                            <p className="text-xs text-[var(--color-muted-foreground)]">写真なし</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* AIコメント */}
                  {spot.ai_comment && (
                    <div className="rounded-lg bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 px-3 py-2.5">
                      <p className="text-xs font-semibold text-[var(--color-primary)] mb-1 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AIコメント
                      </p>
                      <p className="text-sm text-[var(--color-foreground)] leading-relaxed">{spot.ai_comment}</p>
                    </div>
                  )}

                  {/* 改善提案 */}
                  {spot.improvements && spot.improvements.length > 0 && (
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

        {/* 総合評価 */}
        <section>
          <h2 className="section-header text-sm font-bold text-[var(--color-muted-foreground)] uppercase tracking-wider mb-3 border-b border-[var(--color-border)] pb-1.5">
            総合評価
          </h2>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-4 space-y-3">
            <p className="text-sm leading-relaxed text-[var(--color-foreground)]">{summary.total_comment}</p>
            {summary.next_recommendations && summary.next_recommendations.length > 0 && (
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

        {/* フッター */}
        <footer className="border-t border-[var(--color-border)] pt-4 mt-6 flex items-center justify-between">
          <div className="text-xs text-[var(--color-muted-foreground)]">
            <p className="font-semibold text-[var(--color-primary)]">HIKARU 清掃品質管理システム</p>
            <p>生成日時: {new Date(content.generated_at).toLocaleString('ja-JP')}</p>
          </div>
          <div className="text-xs text-[var(--color-muted-foreground)] text-right">
            <p>担当: {job.worker_name}</p>
            <p>Ver.{version}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()

  const [report, setReport]   = React.useState<{ content: ReportContent; version: number; created_at: string } | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError]     = React.useState<string | null>(null)

  React.useEffect(() => {
    async function load() {
      const { data, error: err } = await getReport(id)
      if (err || !data) {
        setError('報告書が見つかりませんでした')
      } else {
        setReport({ content: data.content, version: data.version, created_at: data.created_at })
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[var(--color-error)]">{error ?? '読み込みエラー'}</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-sm text-[var(--color-primary)] hover:underline"
        >
          ← 戻る
        </button>
      </div>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* ツールバー */}
      <div className="no-print flex items-center justify-between mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> 報告書一覧
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => window.print()}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2',
              'bg-[var(--color-primary)] text-white text-sm font-semibold',
              'hover:bg-[var(--color-primary-hover)] transition-colors'
            )}
          >
            <Printer className="h-4 w-4" /> 印刷 / PDF出力
          </button>
        </div>
      </div>

      {/* 報告書本体 */}
      <div className="report-wrapper pb-10">
        <ReportDocument
          content={report.content}
          version={report.version}
          createdAt={report.created_at}
        />
      </div>
    </>
  )
}
