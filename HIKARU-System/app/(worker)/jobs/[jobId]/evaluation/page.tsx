'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { completeJob } from '@/services/jobs.service'
import {
  evaluateAllSpots, loadEvaluations,
  getScoreInfo, RECOMMENDATION_CONFIG,
  type EvaluationRow,
} from '@/services/quality.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn, toast } from '@hikaru/ui'
import {
  Star, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ChevronDown, ChevronUp, Lightbulb, ArrowRight, CheckCheck,
  BarChart3, FileText, Camera,
} from 'lucide-react'

// ============================================================
// 写真検証失敗カード（PHOTO-VALID）
// ============================================================
interface ValidationFailure {
  spotId:   string
  spotName: string
  issues:   string[]
}

function ValidationFailureCard({ failure, projectId }: { failure: ValidationFailure; projectId: string }) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-warning)]/40 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-[var(--color-surface)]">
        <div className="flex flex-col items-center justify-center h-14 w-14 rounded-full shrink-0 text-[10px] font-bold text-center leading-tight bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]">
          評価<br />不能
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-[var(--color-foreground)]">{failure.spotName}</p>
            <span className="rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]">
              ⚠️ 写真確認必要
            </span>
          </div>
          {failure.issues.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {failure.issues.map((issue, i) => (
                <li key={i} className="text-xs text-[var(--color-muted-foreground)]">・{issue}</li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href={`/jobs/${projectId}/after`}
          className="shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-[var(--radius-lg)] font-medium bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]"
        >
          <Camera className="h-3.5 w-3.5" />
          撮り直す
        </Link>
      </div>
    </div>
  )
}

// ============================================================
// スコアサークル
// ============================================================
function ScoreCircle({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const info = getScoreInfo(score)
  const dims = { sm: 'h-14 w-14 text-lg', md: 'h-20 w-20 text-2xl', lg: 'h-28 w-28 text-3xl' }

  return (
    <div className={cn(
      'flex flex-col items-center justify-center rounded-full font-bold',
      dims[size], info.bgClass, info.colorClass
    )}>
      {score}
      <span className="text-[10px] font-medium opacity-70">点</span>
    </div>
  )
}

// ============================================================
// 星表示
// ============================================================
function Stars({ count, size = 'sm' }: { count: number; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(cls, i <= count ? 'text-[var(--color-warning)] fill-[var(--color-warning)]' : 'text-[var(--color-border)]')}
        />
      ))}
    </div>
  )
}

// ============================================================
// ブレークダウンバー
// ============================================================
function BreakdownBar({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-muted-foreground)]">{label}</span>
        <span className="font-semibold text-[var(--color-foreground)]">{pct}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            pct >= 75 ? 'bg-[var(--color-success)]' : pct >= 60 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-error)]'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ============================================================
// スポット評価カード
// ============================================================
function SpotEvaluationCard({
  evaluation,
  photos,
  projectId,
  isStale,
}: {
  evaluation: EvaluationRow
  photos: { beforeUrl?: string; afterUrl?: string }
  projectId: string
  isStale: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)
  const info   = getScoreInfo(evaluation.score)
  const recCfg = RECOMMENDATION_CONFIG[evaluation.recommendation]
  const spotName = evaluation.photo_spots?.name ?? '撮影箇所'
  const afterHref = `/jobs/${projectId}/after?spotId=${evaluation.spot_id}`

  return (
    <div className={cn(
      'rounded-[var(--radius-xl)] border overflow-hidden',
      isStale
        ? 'border-[var(--color-warning)]/50'
        : evaluation.passed ? 'border-[var(--color-success)]/30' : 'border-[var(--color-error)]/30'
    )}>
      {/* ヘッダー */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-[var(--color-surface)] text-left active:bg-[var(--color-muted)] transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <ScoreCircle score={evaluation.score} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-[var(--color-foreground)]">{spotName}</p>
            {isStale && (
              <span className="rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)] border border-[var(--color-warning)]/30">
                ⚠ 旧評価
              </span>
            )}
            <span className={cn(
              'rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold',
              evaluation.recommendation === 'pass'  ? 'bg-[var(--color-success-muted)] text-[var(--color-success-foreground)]' :
              evaluation.recommendation === 'check' ? 'bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)]' :
              'bg-[var(--color-error-muted)] text-[var(--color-error-foreground)]'
            )}>
              {recCfg.emoji} {recCfg.label}
            </span>
          </div>
          <Stars count={info.stars} />
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)] truncate">{evaluation.comment}</p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {/* STALE警告バナー（写真更新後・再評価前） */}
      {isStale && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap bg-[var(--color-warning-muted)]/60 border-t border-[var(--color-warning)]/20">
          <p className="text-xs font-medium flex items-center gap-1 text-[var(--color-warning-foreground)]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            この評価は更新前の写真に基づいています。AI品質評価を再実行してください。
          </p>
          {evaluation.recommendation === 'redo' && (
            <Link
              href={afterHref}
              className="shrink-0 flex items-center gap-1 text-xs font-semibold rounded-[var(--radius-lg)] px-2.5 py-1 bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)] border border-[var(--color-warning)]/40"
            >
              <RefreshCw className="h-3 w-3" /> 再撮影
            </Link>
          )}
        </div>
      )}

      {/* 詳細展開 */}
      {expanded && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-muted)]/30 px-4 py-4 space-y-4">
          {/* Before/After 写真 */}
          {(photos.beforeUrl || photos.afterUrl) && (
            <div className="grid grid-cols-2 gap-2">
              {photos.beforeUrl && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-[var(--color-muted-foreground)]">Before</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos.beforeUrl} alt="Before" className="w-full aspect-[4/3] object-cover rounded-[var(--radius-lg)]" />
                </div>
              )}
              {photos.afterUrl && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-[var(--color-success-foreground)]">After</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photos.afterUrl} alt="After" className="w-full aspect-[4/3] object-cover rounded-[var(--radius-lg)]" />
                </div>
              )}
            </div>
          )}

          {/* 比較コメント */}
          {evaluation.comparison && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)] border border-[var(--color-primary)]/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--color-primary)] mb-1">Before → After 比較</p>
              <p className="text-sm text-[var(--color-foreground)]">{evaluation.comparison}</p>
            </div>
          )}

          {/* ブレークダウン */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[var(--color-muted-foreground)]">評価詳細</p>
            <BreakdownBar label="汚れ除去度"    value={evaluation.dirty_removal} />
            <BreakdownBar label="丁寧さ・細部"  value={evaluation.thoroughness} />
            <BreakdownBar label="光沢・清潔感"  value={evaluation.shine} />
          </div>

          {/* 残課題 */}
          {evaluation.remaining_issues && evaluation.remaining_issues.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/20 px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--color-warning-foreground)] mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> 残っている問題
              </p>
              <ul className="space-y-0.5">
                {evaluation.remaining_issues.map((issue, i) => (
                  <li key={i} className="text-xs text-[var(--color-foreground)]">・{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 改善提案 */}
          {evaluation.improvements && evaluation.improvements.length > 0 && (
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--color-foreground)] mb-1.5 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-[var(--color-warning)]" /> 改善提案
              </p>
              <ul className="space-y-0.5">
                {evaluation.improvements.map((imp, i) => (
                  <li key={i} className="text-xs text-[var(--color-foreground)]">・{imp}</li>
                ))}
              </ul>
            </div>
          )}

          {/* REDO: Fresh評価時の再清掃ナビゲーション（spot指定） */}
          {evaluation.recommendation === 'redo' && !isStale && (
            <Link
              href={afterHref}
              className="flex items-center justify-center gap-1.5 rounded-[var(--radius-lg)] py-2.5 text-sm font-semibold bg-[var(--color-error-muted)] text-[var(--color-error-foreground)] border border-[var(--color-error)]/30 active:opacity-80 transition-opacity"
            >
              <RefreshCw className="h-4 w-4" /> この箇所を再清掃する
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================

export default function EvaluationPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const autoRun = searchParams.get('run') === '1'

  const [evaluations, setEvaluations]               = React.useState<EvaluationRow[]>([])
  const [validationFailures, setValidationFailures] = React.useState<ValidationFailure[]>([])
  const [photos, setPhotos]       = React.useState<any[]>([])
  const [jobId, setJobId]         = React.useState<string | null>(null)
  const [loading, setLoading]     = React.useState(true)
  const [evaluating, setEvaluating] = React.useState(false)
  const [completing, setCompleting] = React.useState(false)
  const [summary, setSummary]     = React.useState<any>(null)

  // 初期化
  React.useEffect(() => {
    async function init() {
      try {
        // ブラウザSupabase auth.getUser() ハングを回避するサーバーAPI経由でtodayJob・photos取得
        const res = await fetch(`/api/jobs/${projectId}`, {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) { router.push(`/jobs/${projectId}`); return }
        const { todayJob, photos: ph } = await res.json()
        if (!todayJob) { router.push(`/jobs/${projectId}`); return }
        setJobId(todayJob.id)

        // 写真データ
        setPhotos(ph ?? [])

        // 既存の評価
        const existing = await loadEvaluations(todayJob.id)
        setEvaluations(existing)

        // ?run=1 なら自動実行
        if (autoRun && existing.length === 0) {
          setTimeout(() => runEvaluation(todayJob.id), 300)
        }
      } catch {
        router.push(`/jobs/${projectId}`)
      } finally {
        setLoading(false)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function runEvaluation(jId?: string) {
    const targetJobId = jId ?? jobId
    if (!targetJobId) return
    setEvaluating(true)

    try {
      const result = await evaluateAllSpots(targetJobId)
      if (result.success) {
        setSummary(result.summary)
        const updated = await loadEvaluations(targetJobId)
        setEvaluations(updated)

        // PHOTO-VALID: 写真検証失敗スポットを抽出（DB保存なし・0点扱いなし）
        const failures: ValidationFailure[] = (result.results ?? [])
          .filter((r: any) => r.validationFailed === true)
          .map((r: any) => ({ spotId: r.spotId, spotName: r.spotName, issues: r.issues ?? [] }))
        setValidationFailures(failures)

        if (failures.length === 0) {
          toast.success('AI品質評価が完了しました')
        } else if (updated.length > 0) {
          toast.success(`${updated.length}箇所評価完了。${failures.length}箇所は写真の撮り直しが必要です。`)
        } else {
          toast.error('写真が評価条件を満たしていません。撮り直してください。')
        }
      } else {
        toast.error(`評価に失敗しました: ${result.error}`)
      }
    } catch {
      toast.error('評価に失敗しました')
    } finally {
      setEvaluating(false)
    }
  }

  async function handleComplete() {
    if (!jobId) return
    setCompleting(true)
    try {
      const ok = await completeJob(jobId)
      if (ok) {
        toast.success('作業完了しました！お疲れ様でした！')
        router.replace(`/jobs`)
      } else {
        toast.error('完了処理に失敗しました')
      }
    } catch {
      toast.error('完了処理に失敗しました')
    } finally {
      setCompleting(false)
    }
  }

  // 写真URLマップ
  function getSpotPhotos(spotId: string) {
    return {
      beforeUrl: photos.find((p) => p.spot_id === spotId && p.photo_type === 'before')?.url,
      afterUrl:  photos.find((p) => p.spot_id === spotId && p.photo_type === 'after')?.url,
    }
  }

  // QUALITY-FRESH: stale評価検出
  const hasStaleEvaluations = React.useMemo(
    () => evaluations.some((e) => e.fresh === false),
    [evaluations],
  )

  // サマリー計算
  const computedSummary = React.useMemo(() => {
    if (evaluations.length === 0) return null
    const avg = Math.round(evaluations.reduce((s, e) => s + e.score, 0) / evaluations.length)
    return {
      averageScore: avg,
      passed: evaluations.filter((e) => e.passed).length,
      failed: evaluations.filter((e) => !e.passed).length,
      total:  evaluations.length,
      allPassed: evaluations.every((e) => e.passed),
    }
  }, [evaluations])

  const overallInfo = computedSummary ? getScoreInfo(computedSummary.averageScore) : null

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="AI品質評価" showBack />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader title="AI品質評価" showBack />

      <div className="pb-32">
        {/* QUALITY-FRESH: stale警告バナー */}
        {!evaluating && hasStaleEvaluations && (
          <div className="mx-4 mt-4 rounded-[var(--radius-xl)] bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/40 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-[var(--color-warning-foreground)] shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-warning-foreground)]">写真が更新されています</p>
              <p className="text-xs text-[var(--color-warning-foreground)]/80 mt-0.5">撮り直した写真があります。AI品質評価を再実行してください。</p>
            </div>
          </div>
        )}

        {/* 実行中 */}
        {evaluating && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="h-16 w-16 rounded-full border-4 border-[var(--color-primary)] border-t-transparent animate-spin mb-4" />
            <p className="text-base font-semibold text-[var(--color-foreground)]">AI品質評価中...</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">写真を解析しています。しばらくお待ちください。</p>
          </div>
        )}

        {/* サマリーカード */}
        {!evaluating && computedSummary && overallInfo && (
          <div className={cn(
            'mx-4 mt-4 rounded-[var(--radius-xl)] p-5',
            computedSummary.allPassed
              ? 'bg-[var(--color-success)] text-white'
              : 'bg-[var(--color-warning-muted)] border border-[var(--color-warning)]/30'
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                'flex flex-col items-center justify-center h-20 w-20 rounded-full font-bold shrink-0',
                computedSummary.allPassed ? 'bg-white/20 text-white' : overallInfo.bgClass + ' ' + overallInfo.colorClass
              )}>
                <span className="text-2xl">{computedSummary.averageScore}</span>
                <span className="text-[10px] opacity-80">点</span>
              </div>
              <div>
                <p className={cn('font-bold text-base', !computedSummary.allPassed && 'text-[var(--color-foreground)]')}>
                  {computedSummary.allPassed ? '全箇所合格！' : `${computedSummary.failed}箇所が要改善`}
                </p>
                <p className={cn('text-sm mt-0.5', !computedSummary.allPassed ? 'text-[var(--color-muted-foreground)]' : 'opacity-80')}>
                  {computedSummary.passed}/{computedSummary.total}箇所合格
                </p>
                <Stars count={overallInfo.stars} size="md" />
              </div>
            </div>
          </div>
        )}

        {/* 評価なし状態（評価もValidation失敗もない場合のみ） */}
        {!evaluating && evaluations.length === 0 && validationFailures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <BarChart3 className="h-14 w-14 text-[var(--color-muted-foreground)] opacity-40 mb-4" />
            <p className="text-base font-semibold">まだAI評価が実行されていません</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">下のボタンから品質チェックを開始してください</p>
          </div>
        )}

        {/* スポット別評価リスト */}
        {!evaluating && evaluations.length > 0 && (
          <div className="px-4 mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              箇所別評価 ({evaluations.length}件)
            </p>
            {evaluations.map((ev) => (
              <SpotEvaluationCard
                key={ev.id}
                evaluation={ev}
                photos={getSpotPhotos(ev.spot_id)}
                projectId={projectId}
                isStale={ev.fresh === false}
              />
            ))}
          </div>
        )}

        {/* PHOTO-VALID: 写真検証失敗スポット（0点扱いなし・DB記録なし） */}
        {!evaluating && validationFailures.length > 0 && (
          <div className="px-4 mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-warning-foreground)]">
              写真確認が必要な箇所 ({validationFailures.length}件)
            </p>
            {validationFailures.map((f) => (
              <ValidationFailureCard key={f.spotId} failure={f} projectId={projectId} />
            ))}
          </div>
        )}
      </div>

      {/* 固定フッター */}
      <div className="fixed bottom-[var(--bottom-nav-height)] left-0 right-0 px-4 pb-4 pt-3 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)] space-y-2">
        {evaluations.length === 0 ? (
          <button
            onClick={() => runEvaluation()}
            disabled={evaluating}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-[var(--radius-xl)] py-4',
              'bg-[var(--color-primary)] text-white text-base font-semibold',
              'active:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50'
            )}
          >
            <BarChart3 className="h-5 w-5" />
            AI品質チェックを実行
          </button>
        ) : (
          <>
            {/* 報告書ボタン（評価完了後は常に表示） */}
            <Link
              href={`/jobs/${projectId}/report`}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-[var(--radius-xl)] py-3.5',
                'bg-[var(--color-primary)] text-white text-base font-semibold',
                'active:bg-[var(--color-primary-hover)] transition-colors'
              )}
            >
              <FileText className="h-5 w-5" />
              AI報告書を作成する
            </Link>

            {/* 作業完了 / 再清掃 */}
            {computedSummary?.allPassed ? (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full flex items-center justify-center gap-2 rounded-[var(--radius-xl)] py-3 border border-[var(--color-success)]/40 bg-[var(--color-success-muted)] text-[var(--color-success-foreground)] text-sm font-semibold active:bg-[var(--color-success)]/20 transition-colors disabled:opacity-50"
              >
                {completing ? (
                  <div className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                {completing ? '処理中...' : '作業完了'}
              </button>
            ) : (
              <div className="flex gap-2">
                <Link
                  href={`/jobs/${projectId}/after${evaluations.find((e) => e.recommendation === 'redo' && e.fresh !== false)?.spot_id ? `?spotId=${evaluations.find((e) => e.recommendation === 'redo' && e.fresh !== false)!.spot_id}` : ''}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-xl)] py-3 bg-[var(--color-warning-muted)] text-[var(--color-warning-foreground)] text-sm font-semibold active:bg-[var(--color-warning)]/20 transition-colors"
                >
                  <RefreshCw className="h-4 w-4" /> 再清掃する
                </Link>
                <button
                  onClick={() => runEvaluation()}
                  disabled={evaluating}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-[var(--radius-xl)] py-3 border border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-foreground)] text-sm font-semibold active:bg-[var(--color-border)] transition-colors disabled:opacity-50"
                >
                  <BarChart3 className="h-4 w-4" /> 再評価
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
