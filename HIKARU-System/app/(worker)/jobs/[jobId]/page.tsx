'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { getOrCreateTodayJob, completeJob } from '@/services/jobs.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { WorkProgress, SpotStatusDot } from '@/components/worker/WorkProgress'
import { cn } from '@hikaru/ui'
import {
  MapPin, Phone, ShieldAlert, BookOpen, PlayCircle,
  Camera, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, Info, Sparkles, BarChart3, FileText,
} from 'lucide-react'
import { toast } from '@hikaru/ui'

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 py-3 border-b border-[var(--color-border)] last:border-0">
      <Icon className="h-4 w-4 text-[var(--color-muted-foreground)] mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        <p className="text-sm text-[var(--color-foreground)] mt-0.5">{value}</p>
      </div>
    </div>
  )
}

export default function JobDetailPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const [project, setProject] = React.useState<any>(null)
  const [photoSpots, setPhotoSpots] = React.useState<any[]>([])
  const [activeJob, setActiveJob] = React.useState<any>(null)
  const [photos, setPhotos] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [starting, setStarting] = React.useState(false)
  const [completing, setCompleting] = React.useState(false)
  const [generatingReport, setGeneratingReport] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        if (!res.ok) return
        const { project, spots, todayJob, photos: ph } = await res.json()
        setProject(project)
        setPhotoSpots(spots ?? [])
        if (todayJob) {
          setActiveJob(todayJob)
          setPhotos(ph ?? [])
        }
      } catch (err) {
        console.error('[JobDetailPage] load error:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  async function handleStartWork() {
    setStarting(true)
    const job = await getOrCreateTodayJob(projectId)
    if (!job) {
      toast.error('作業開始に失敗しました')
      setStarting(false)
      return
    }
    setActiveJob(job)
    router.push(`/jobs/${projectId}/before`)
  }

  async function handleComplete() {
    if (!activeJob) return

    const requiredSpots = photoSpots.filter((s) => s.is_required)
    const completedSpots = requiredSpots.filter((s) => {
      const hasBefore = photos.some((p) => p.spot_id === s.id && p.photo_type === 'before')
      const hasAfter  = photos.some((p) => p.spot_id === s.id && p.photo_type === 'after')
      return hasBefore && hasAfter
    })

    if (completedSpots.length < requiredSpots.length) {
      toast.error(`必須撮影箇所があと${requiredSpots.length - completedSpots.length}件残っています`)
      return
    }

    setCompleting(true)
    const ok = await completeJob(activeJob.id)
    if (!ok) {
      toast.error('完了処理に失敗しました')
      setCompleting(false)
      return
    }

    const completedAt = new Date().toISOString()
    setActiveJob((prev: any) => ({ ...prev, status: 'completed', completed_at: completedAt }))
    setCompleting(false)

    // 報告書を自動生成
    setGeneratingReport(true)
    toast.success('作業完了！報告書を自動生成しています...')
    try {
      const res = await fetch('/api/ai/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJob.id }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success('報告書を生成しました！お疲れ様でした！')
        router.push(`/jobs/${projectId}/evaluation`)
      } else {
        toast.error('報告書の自動生成に失敗しました。評価ページから手動で生成できます。')
        router.push(`/jobs/${projectId}/evaluation`)
      }
    } catch {
      toast.error('ネットワークエラーが発生しました')
    } finally {
      setGeneratingReport(false)
    }
  }

  // Photo stats
  const beforeCount = photoSpots.filter((s) =>
    photos.some((p) => p.spot_id === s.id && p.photo_type === 'before')
  ).length
  const afterCount = photoSpots.filter((s) =>
    photos.some((p) => p.spot_id === s.id && p.photo_type === 'after')
  ).length
  const totalSpots = photoSpots.length
  const isJobCompleted = activeJob?.status === 'completed'

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="案件詳細" showBack />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="案件詳細" showBack />
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-[var(--color-muted-foreground)]">案件が見つかりませんでした</p>
          <button onClick={() => router.back()} className="mt-4 text-sm text-[var(--color-primary)]">
            戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader
        title={project.name}
        showBack
        rightAction={
          <Link
            href={`/jobs/${projectId}/manual`}
            className="flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--color-primary-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]"
          >
            <BookOpen className="h-3.5 w-3.5" /> マニュアル
          </Link>
        }
      />

      <div className={cn("space-y-0", activeJob && "pb-44")}>
        {/* 完了バナー */}
        {isJobCompleted && (
          <div className="bg-[var(--color-success)] px-4 py-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-white shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">作業完了</p>
              {activeJob?.completed_at && (
                <p className="text-xs text-white/80">
                  {new Date(activeJob.completed_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に完了
                </p>
              )}
            </div>
          </div>
        )}

        {/* 進捗バー（作業中のみ） */}
        {activeJob && !isJobCompleted && totalSpots > 0 && (
          <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4 space-y-3">
            <WorkProgress
              total={totalSpots}
              completed={beforeCount}
              label="Before撮影"
            />
            <WorkProgress
              total={totalSpots}
              completed={afterCount}
              label="After撮影"
            />
          </div>
        )}

        {/* 店舗・案件情報 */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] mb-3">
            店舗情報
          </h2>
          <div>
            <InfoRow icon={MapPin}      label="作業場所"      value={project.location_name} />
            <InfoRow icon={Phone}       label="電話番号"      value={project.phone} />
            <InfoRow icon={ShieldAlert} label="緊急連絡先"    value={project.emergency_contact} />
            <InfoRow icon={Clock}       label="作業可能時間"  value={project.business_hours} />
            <InfoRow icon={Info}        label="注意事項"      value={project.notes} />
          </div>
        </div>

        {/* 作業開始時刻 */}
        {activeJob && (
          <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4">
            <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <Clock className="h-4 w-4" />
              <span>
                開始: {new Date(activeJob.started_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        )}

        {/* 撮影箇所一覧 */}
        {totalSpots > 0 && (
          <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                撮影箇所
              </h2>
              {activeJob && !isJobCompleted && (
                <Link
                  href={`/jobs/${projectId}/before`}
                  className="text-xs font-medium text-[var(--color-primary)]"
                >
                  撮影する →
                </Link>
              )}
            </div>
            <div className="space-y-2">
              {photoSpots.map((spot) => {
                const hasBefore = photos.some((p) => p.spot_id === spot.id && p.photo_type === 'before')
                const hasAfter  = photos.some((p) => p.spot_id === spot.id && p.photo_type === 'after')
                return (
                  <div
                    key={spot.id}
                    className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-[var(--color-muted)] px-3 py-2.5"
                  >
                    <SpotStatusDot hasBefore={hasBefore} hasAfter={hasAfter} required={spot.is_required} />
                    <span className="flex-1 text-sm text-[var(--color-foreground)]">{spot.name}</span>
                    {!spot.is_required && (
                      <span className="text-[10px] text-[var(--color-muted-foreground)]">任意</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* マニュアル & AIチャット & 品質評価 & 報告書ボタン */}
        <div className="px-4 py-4 bg-[var(--color-surface)] border-b border-[var(--color-border)] grid grid-cols-2 gap-3">
          <Link
            href={`/jobs/${projectId}/manual`}
            className="flex flex-col items-center gap-1.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-3 active:bg-[var(--color-border)] transition-colors"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)]">
              <BookOpen className="h-4.5 w-4.5 text-[var(--color-primary)]" />
            </span>
            <p className="text-[10px] font-semibold text-[var(--color-foreground)]">マニュアル</p>
          </Link>
          <Link
            href={`/jobs/${projectId}/chat`}
            className="flex flex-col items-center gap-1.5 rounded-[var(--radius-xl)] bg-[var(--color-primary)] px-2 py-3 active:bg-[var(--color-primary-hover)] transition-colors shadow-[var(--shadow-sm)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-white/20">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </span>
            <p className="text-[10px] font-semibold text-white">AIに質問</p>
          </Link>
          {activeJob && (
            <Link
              href={`/jobs/${projectId}/evaluation`}
              className="flex flex-col items-center gap-1.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-3 active:bg-[var(--color-border)] transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-success-muted)]">
                <BarChart3 className="h-4.5 w-4.5 text-[var(--color-success)]" />
              </span>
              <p className="text-[10px] font-semibold text-[var(--color-foreground)]">AI品質評価</p>
            </Link>
          )}
          {activeJob && (
            <Link
              href={`/jobs/${projectId}/report`}
              className="flex flex-col items-center gap-1.5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-muted)] px-2 py-3 active:bg-[var(--color-border)] transition-colors"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-warning-muted)]">
                <FileText className="h-4.5 w-4.5 text-[var(--color-warning-foreground)]" />
              </span>
              <p className="text-[10px] font-semibold text-[var(--color-foreground)]">報告書</p>
            </Link>
          )}
        </div>
      </div>

      {/* 固定フッター: 作業中・完了時のみ */}
      {activeJob && (
        <div className="fixed bottom-[var(--bottom-nav-height)] left-0 right-0 px-4 pb-4 pt-3 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)]">
          {isJobCompleted ? (
            <div className="flex gap-2">
              <Link
                href={`/jobs/${projectId}/report`}
                className="flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-xl)] bg-[var(--color-primary)] py-4 text-base font-semibold text-white active:bg-[var(--color-primary-hover)] transition-colors"
              >
                <FileText className="h-5 w-5" /> 報告書
              </Link>
              <button
                onClick={() => router.push('/jobs')}
                className="flex-1 rounded-[var(--radius-xl)] bg-[var(--color-muted)] py-4 text-base font-semibold text-[var(--color-muted-foreground)]"
              >
                一覧に戻る
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link
                href={`/jobs/${projectId}/${beforeCount < totalSpots ? 'before' : 'after'}`}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-[var(--radius-xl)] py-4',
                  'text-base font-semibold text-white',
                  'bg-[var(--color-primary)] active:bg-[var(--color-primary-active)]',
                  'transition-colors'
                )}
              >
                <Camera className="h-5 w-5" />
                {beforeCount < totalSpots ? 'Before撮影' : 'After撮影'}
              </Link>
              {afterCount === totalSpots && totalSpots > 0 && (
                <button
                  onClick={handleComplete}
                  disabled={completing || generatingReport}
                  className="flex-1 rounded-[var(--radius-xl)] bg-[var(--color-success)] py-4 text-base font-semibold text-white active:bg-[var(--color-success-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(completing || generatingReport) && (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  )}
                  {completing ? '完了処理中...' : generatingReport ? '報告書生成中...' : '作業完了'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 作業未開始: コンテンツ末尾のインラインCTA */}
      {!activeJob && (
        <div className="px-4 pt-2 pb-10">
          <button
            onClick={handleStartWork}
            disabled={starting}
            className={cn(
              'w-full flex items-center justify-center gap-2',
              'rounded-[var(--radius-xl)] py-4',
              'bg-[var(--color-primary)] text-white',
              'text-base font-semibold',
              'active:bg-[var(--color-primary-active)] transition-colors',
              'disabled:opacity-50'
            )}
          >
            {starting ? (
              <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <PlayCircle className="h-5 w-5" />
            )}
            {starting ? '準備中...' : '作業を開始する'}
          </button>
        </div>
      )}
    </div>
  )
}
