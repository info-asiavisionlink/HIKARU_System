'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import {
  FileText, Image as ImageIcon, Video, HelpCircle,
  AlertTriangle, BookOpen, ChevronDown, ChevronUp,
  ExternalLink, Sparkles,
} from 'lucide-react'

type ManualType = 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'

interface Manual {
  id: string
  type: ManualType
  title: string
  content: string | null
  file_url: string | null
  order_num: number
}

const typeConfig: Record<ManualType, { icon: React.ElementType; color: string; label: string }> = {
  text:  { icon: FileText,       color: 'bg-[var(--color-muted)]          text-[var(--color-muted-foreground)]',  label: '文章' },
  faq:   { icon: HelpCircle,     color: 'bg-[var(--color-info-muted)]     text-[var(--color-info-foreground)]',   label: 'FAQ' },
  note:  { icon: AlertTriangle,  color: 'bg-[var(--color-warning-muted)]  text-[var(--color-warning-foreground)]', label: '注意事項' },
  pdf:   { icon: FileText,       color: 'bg-[var(--color-primary-muted)]  text-[var(--color-primary)]',            label: 'PDF' },
  image: { icon: ImageIcon,      color: 'bg-[var(--color-success-muted)]  text-[var(--color-success-foreground)]', label: '画像' },
  video: { icon: Video,          color: 'bg-[var(--color-error-muted)]    text-[var(--color-error-foreground)]',   label: '動画' },
}

function ManualCard({ manual }: { manual: Manual }) {
  const [open, setOpen] = React.useState(manual.type === 'note')
  const config = typeConfig[manual.type]
  const Icon = config.icon

  return (
    <div className={cn(
      'rounded-[var(--radius-xl)] border overflow-hidden',
      manual.type === 'note'
        ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning-muted)]'
        : 'border-[var(--color-border)] bg-[var(--color-surface)]'
    )}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-black/5 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] shrink-0', config.color)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">{manual.title}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">{config.label}</p>
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
          : <ChevronDown className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[var(--color-border)]">
          {manual.content && (
            <p className="mt-3 text-sm text-[var(--color-foreground)] whitespace-pre-wrap leading-relaxed">
              {manual.content}
            </p>
          )}
          {manual.type === 'pdf' && manual.file_url && (
            <a
              href={manual.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)] px-4 py-3 text-sm font-medium text-[var(--color-primary)] active:bg-[var(--color-primary)]/20 transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0" />
              PDFを開く
              <ExternalLink className="h-3.5 w-3.5 ml-auto" />
            </a>
          )}
          {manual.type === 'image' && manual.file_url && (
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={manual.file_url} alt={manual.title} className="w-full rounded-[var(--radius-lg)] object-contain max-h-64" />
            </div>
          )}
          {manual.type === 'video' && manual.file_url && (
            <div className="mt-3">
              <video src={manual.file_url} controls playsInline className="w-full rounded-[var(--radius-lg)]" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function ManualPage() {
  const { jobId: projectId } = useParams<{ jobId: string }>()
  const [manuals, setManuals]       = React.useState<Manual[]>([])
  const [loading, setLoading]       = React.useState(true)
  const [filter, setFilter]         = React.useState<ManualType | 'all'>('all')

  React.useEffect(() => {
    async function load() {
      try {
        // ブラウザSupabase auth/session ハングを回避するサーバーAPI経由でmanuals取得
        const res = await fetch(`/api/jobs/${projectId}/manuals`, {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) return
        const { manuals } = await res.json()
        setManuals(manuals ?? [])
      } catch {
        // エラー時もspinnerを解除する
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId])

  const types    = React.useMemo(() => Array.from(new Set(manuals.map((m) => m.type))), [manuals])
  const filtered = filter === 'all' ? manuals : manuals.filter((m) => m.type === filter)
  const notes    = filtered.filter((m) => m.type === 'note')
  const others   = filtered.filter((m) => m.type !== 'note')

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader
        title="マニュアル"
        showBack
        rightAction={
          <Link
            href={`/jobs/${projectId}/chat`}
            className="flex items-center gap-1.5 rounded-[var(--radius-full)] bg-[var(--color-primary)] px-3 py-1.5 active:bg-[var(--color-primary-hover)] transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-white" />
            <span className="text-xs font-semibold text-white">AIに質問</span>
          </Link>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          {/* AIチャットバナー */}
          <Link href={`/jobs/${projectId}/chat`}>
            <div className={cn(
              'mx-4 mt-4 flex items-center gap-3 rounded-[var(--radius-xl)]',
              'bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.45_0.22_280)]',
              'px-4 py-3.5 shadow-[var(--shadow-md)]',
              'active:scale-[0.98] transition-transform'
            )}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 shrink-0">
                <Sparkles className="h-5 w-5 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">AIアシスタントに質問する</p>
                <p className="text-xs text-white/75 mt-0.5">このマニュアルを参照して回答します</p>
              </div>
            </div>
          </Link>

          {manuals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <BookOpen className="h-12 w-12 text-[var(--color-muted-foreground)] opacity-40 mb-3" />
              <p className="text-sm font-medium text-[var(--color-foreground)]">マニュアルがありません</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">管理者がマニュアルを登録すると表示されます</p>
            </div>
          ) : (
            <>
              {types.length > 1 && (
                <div className="flex gap-1.5 px-4 py-3 mt-3 border-y border-[var(--color-border)] overflow-x-auto scrollbar-none bg-[var(--color-surface)]">
                  <button
                    onClick={() => setFilter('all')}
                    className={cn(
                      'shrink-0 rounded-[var(--radius-full)] px-3.5 py-1.5 text-xs font-medium transition-colors',
                      filter === 'all' ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                    )}
                  >
                    すべて ({manuals.length})
                  </button>
                  {types.map((t) => {
                    const cfg = typeConfig[t]
                    return (
                      <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className={cn(
                          'shrink-0 rounded-[var(--radius-full)] px-3.5 py-1.5 text-xs font-medium transition-colors',
                          filter === t ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                        )}
                      >
                        {cfg.label} ({manuals.filter((m) => m.type === t).length})
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="px-4 py-4 space-y-3 pb-8">
                {notes.map((m) => <ManualCard key={m.id} manual={m} />)}
                {others.map((m) => <ManualCard key={m.id} manual={m} />)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
