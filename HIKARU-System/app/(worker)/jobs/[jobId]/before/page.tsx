'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getOrCreateTodayJob } from '@/services/jobs.service'
import { uploadPhoto, getJobPhotos, type PhotoRow } from '@/services/photos.service'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { PhotoCapture } from '@/components/worker/PhotoCapture'
import { WorkProgress } from '@/components/worker/WorkProgress'
import { cn, toast } from '@hikaru/ui'
import { ChevronRight } from 'lucide-react'

export default function BeforePage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const [spots, setSpots] = React.useState<any[]>([])
  const [jobId, setJobId] = React.useState<string | null>(null)
  const [photos, setPhotos] = React.useState<PhotoRow[]>([])
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({})
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const supabase = createClient()

      const job = await getOrCreateTodayJob(projectId)
      if (!job) { router.push(`/jobs/${projectId}`); return }
      setJobId(job.id)

      // project_id ベースで撮影箇所を取得（migration 008 で追加）
      const { data: spotsData } = await supabase
        .from('photo_spots')
        .select('*')
        .eq('project_id', projectId)
        .order('order_num', { ascending: true })
      setSpots(spotsData ?? [])

      const existing = await getJobPhotos(job.id)
      setPhotos(existing.filter((p) => p.photo_type === 'before'))

      setLoading(false)
    }
    load()
  }, [projectId, router])

  function getSpotPhoto(spotId: string): PhotoRow | undefined {
    return photos.find((p) => p.spot_id === spotId)
  }

  async function handleCapture(spotId: string, file: File) {
    if (!jobId) return
    setUploading((prev) => ({ ...prev, [spotId]: true }))

    const result = await uploadPhoto(jobId, spotId, 'before', file)
    if (result) {
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.spot_id !== spotId)
        return [...filtered, result]
      })
      toast.success('保存しました')
    } else {
      toast.error('保存に失敗しました')
    }

    setUploading((prev) => ({ ...prev, [spotId]: false }))
  }

  async function handleDelete(spotId: string) {
    setPhotos((prev) => prev.filter((p) => p.spot_id !== spotId))
  }

  const completedCount = spots.filter((s) => !!getSpotPhoto(s.id)).length
  const totalCount = spots.length
  const allDone = completedCount === totalCount && totalCount > 0

  if (loading) {
    return (
      <div className="min-h-dvh bg-[var(--color-background)]">
        <WorkerHeader title="Before写真" showBack />
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader title="Before写真" showBack />

      {/* 進捗 */}
      <div className="sticky top-[var(--header-height)] z-10 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
        <WorkProgress total={totalCount} completed={completedCount} label="Before撮影" />
      </div>

      {/* 説明 */}
      <div className="px-4 py-3 bg-[var(--color-primary-muted)] border-b border-[var(--color-primary)]/20">
        <p className="text-sm text-[var(--color-primary)] font-medium">
          清掃前の状態を撮影してください
        </p>
        <p className="text-xs text-[var(--color-primary)]/70 mt-0.5">
          必須項目（*）は必ず撮影してください
        </p>
      </div>

      {/* 撮影箇所リスト */}
      <div className="px-4 py-3 space-y-4 pb-32">
        {spots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              撮影箇所が登録されていません
            </p>
            <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
              管理者に撮影箇所の登録を依頼してください
            </p>
          </div>
        ) : (
          spots.map((spot, idx) => {
            const existing = getSpotPhoto(spot.id)
            return (
              <div key={spot.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-bold text-[var(--color-muted-foreground)] shrink-0">
                    {idx + 1}
                  </span>
                  <span className="font-semibold text-base text-[var(--color-foreground)]">
                    {spot.name}
                  </span>
                  {spot.is_required && (
                    <span className="text-sm text-[var(--color-error)]">*</span>
                  )}
                </div>
                {spot.description && (
                  <p className="text-xs text-[var(--color-muted-foreground)] pl-8">
                    {spot.description}
                  </p>
                )}
                <div className="pl-8">
                  <PhotoCapture
                    currentUrl={existing?.url ?? null}
                    onCapture={(file) => handleCapture(spot.id, file)}
                    onDelete={() => handleDelete(spot.id)}
                    loading={uploading[spot.id] ?? false}
                    required={spot.is_required}
                  />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 固定フッターボタン */}
      <div className="fixed bottom-[var(--bottom-nav-height)] left-0 right-0 px-4 pb-4 pt-3 bg-[var(--color-surface)]/95 backdrop-blur-md border-t border-[var(--color-border)]">
        {allDone ? (
          <button
            onClick={() => router.push(`/jobs/${projectId}/after`)}
            className={cn(
              'w-full flex items-center justify-center gap-2',
              'rounded-[var(--radius-xl)] py-4',
              'bg-[var(--color-success)] text-white',
              'text-base font-semibold',
              'active:bg-[var(--color-success-hover)] transition-colors'
            )}
          >
            After写真へ進む <ChevronRight className="h-5 w-5" />
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded-[var(--radius-lg)] bg-[var(--color-warning-muted)] px-3 py-2.5 text-center">
              <p className="text-sm font-medium text-[var(--color-warning-foreground)]">
                残り {totalCount - completedCount}件撮影してください
              </p>
            </div>
            {completedCount > 0 && (
              <button
                onClick={() => router.push(`/jobs/${projectId}`)}
                className="w-full rounded-[var(--radius-xl)] bg-[var(--color-muted)] py-3.5 text-sm font-semibold text-[var(--color-muted-foreground)]"
              >
                一時中断して詳細へ戻る
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
