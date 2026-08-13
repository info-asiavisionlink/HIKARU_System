'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { completeJob } from '@/services/jobs.service'
import { uploadPhoto, type PhotoRow } from '@/services/photos.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { PhotoCapture } from '@/components/worker/PhotoCapture'
import { WorkProgress } from '@/components/worker/WorkProgress'
import { cn, toast } from '@hikaru/ui'
import { CheckCircle2, ArrowLeft, BarChart3 } from 'lucide-react'

export default function AfterPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const [spots, setSpots] = React.useState<any[]>([])
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [allPhotos, setAllPhotos] = React.useState<PhotoRow[]>([])
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({})
  const [loading, setLoading] = React.useState(true)
  const [completing, setCompleting] = React.useState(false)

  React.useEffect(() => {
    async function load() {
      try {
        // todayJob + photo_spots + 既存写真を一括取得（サーバーAPI・ブラウザSupabase auth.getUser()ハング回避）
        const res = await fetch(`/api/jobs/${projectId}`, {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) { router.push(`/jobs/${projectId}`); return }
        const { photoSpots, todayJob, photos } = await res.json()

        if (!todayJob) { router.push(`/jobs/${projectId}`); return }
        if (todayJob.status === 'completed') { router.push(`/jobs/${projectId}`); return }

        setJobId(todayJob.id)
        setSpots(photoSpots ?? [])
        setAllPhotos(photos ?? [])
      } catch {
        router.push(`/jobs/${projectId}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId, router])

  function getSpotPhoto(spotId: string, type: 'before' | 'after'): PhotoRow | undefined {
    return allPhotos.find((p) => p.spot_id === spotId && p.photo_type === type)
  }

  async function handleCapture(spotId: string, file: File) {
    if (!jobId) return
    setUploading((prev) => ({ ...prev, [spotId]: true }))

    const result = await uploadPhoto(jobId, spotId, 'after', file)
    if (result) {
      setAllPhotos((prev) => {
        const filtered = prev.filter((p) => !(p.spot_id === spotId && p.photo_type === 'after'))
        return [...filtered, result]
      })
      toast.success('保存しました')
    } else {
      toast.error('保存に失敗しました')
    }
    setUploading((prev) => ({ ...prev, [spotId]: false }))
  }

  async function handleDelete(spotId: string) {
    setAllPhotos((prev) => prev.filter((p) => !(p.spot_id === spotId && p.photo_type === 'after')))
  }

  async function handleComplete() {
    if (!jobId) return
    const requiredSpots = spots.filter((s) => s.is_required)
    const missing = requiredSpots.filter((s) => !getSpotPhoto(s.id, 'after'))
    if (missing.length > 0) {
      toast.error(`必須撮影箇所があと${missing.length}件残っています`)
      return
    }
    setCompleting(true)
    const ok = await completeJob(jobId)
    if (ok) {
      toast.success('作業完了しました！お疲れ様でした！')
      router.replace(`/jobs/${projectId}`)
    } else {
      toast.error('完了処理に失敗しました')
    }
    setCompleting(false)
  }

  const afterCount = spots.filter((s) => !!getSpotPhoto(s.id, 'after')).length
  const totalCount = spots.length
  const requiredCount = spots.filter((s) => s.is_required).length
  const requiredDone = spots.filter((s) => s.is_required && !!getSpotPhoto(s.id, 'after')).length
  const canComplete = requiredDone >= requiredCount

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="After写真" showBack />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader title="After写真" showBack />

      {/* 進捗 */}
      <div className="sticky top-[var(--header-height)] z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
        <WorkProgress total={totalCount} completed={afterCount} label="After撮影" />
      </div>

      {/* 説明 */}
      <div className="px-4 py-3 bg-[var(--color-success-muted)] border-b border-[var(--color-success)]/20">
        <p className="text-sm text-[var(--color-success-foreground)] font-medium">
          清掃後の状態を撮影してください
        </p>
        <p className="text-xs text-[var(--color-success-foreground)]/70 mt-0.5">
          すべて撮影すると作業完了できます
        </p>
      </div>

      {/* 撮影箇所リスト */}
      <div className="px-4 py-4 space-y-6 pb-40">
        {spots.map((spot, idx) => {
          const beforePhoto = getSpotPhoto(spot.id, 'before')
          const afterPhoto  = getSpotPhoto(spot.id, 'after')
          return (
            <div key={spot.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-bold text-[var(--color-muted-foreground)] shrink-0">
                  {idx + 1}
                </span>
                <span className="font-semibold text-base text-[var(--color-foreground)]">
                  {spot.name}
                </span>
                {spot.is_required && <span className="text-sm text-[var(--color-error)]">*</span>}
              </div>

              <div className="pl-8 grid grid-cols-2 gap-3">
                {/* Before (参照用・読み取り専用) */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Before</p>
                  {beforePhoto?.url ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] bg-black">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={beforePhoto.url} alt="Before" className="w-full h-full object-cover opacity-90" />
                    </div>
                  ) : (
                    <div className="aspect-[4/3] rounded-[var(--radius-lg)] bg-[var(--color-muted)] flex items-center justify-center">
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">未撮影</p>
                    </div>
                  )}
                </div>

                {/* After */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-[var(--color-success-foreground)]">After</p>
                  <PhotoCapture
                    currentUrl={afterPhoto?.url ?? null}
                    onCapture={(file) => handleCapture(spot.id, file)}
                    onDelete={() => handleDelete(spot.id)}
                    loading={uploading[spot.id] ?? false}
                    required={spot.is_required}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 固定フッターボタン */}
      <div className="fixed bottom-[var(--bottom-nav-height)] left-0 right-0 px-4 pb-4 pt-3 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)]">
        {canComplete ? (
          <div className="space-y-2">
            {/* AI品質チェックボタン（推奨） */}
            <button
              onClick={() => router.push(`/jobs/${projectId}/evaluation?run=1`)}
              className={cn(
                'w-full flex items-center justify-center gap-2',
                'rounded-[var(--radius-xl)] py-4',
                'bg-[var(--color-primary)] text-white',
                'text-base font-semibold',
                'active:bg-[var(--color-primary-hover)] transition-colors'
              )}
            >
              <BarChart3 className="h-5 w-5" />
              AI品質チェックへ進む
            </button>
            {/* スキップして完了 */}
            <button
              onClick={handleComplete}
              disabled={completing}
              className="w-full rounded-[var(--radius-xl)] py-3 bg-[var(--color-muted)] text-sm font-medium text-[var(--color-muted-foreground)] active:bg-[var(--color-border)] transition-colors disabled:opacity-50"
            >
              {completing ? '処理中...' : 'AIチェックなしで完了する'}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-warning-muted)] px-3 py-2.5 text-center">
              <p className="text-sm font-medium text-[var(--color-warning-foreground)]">
                残り {requiredCount - requiredDone}件撮影してください
              </p>
            </div>
            <button
              onClick={() => router.push(`/jobs/${projectId}/before`)}
              className="w-full flex items-center justify-center gap-1.5 rounded-[var(--radius-xl)] bg-[var(--color-muted)] py-3.5 text-sm font-semibold text-[var(--color-muted-foreground)]"
            >
              <ArrowLeft className="h-4 w-4" /> Before写真に戻る
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
