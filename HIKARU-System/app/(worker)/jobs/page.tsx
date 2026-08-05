'use client'

import * as React from 'react'
import Link from 'next/link'
import { getWorkerProjects, type WorkerProject } from '@/services/worker-projects.service'
import { cn } from '@hikaru/ui'
import {
  Search, X, MapPin, ChevronRight,
  CheckCircle2, PlayCircle, Briefcase, SlidersHorizontal,
} from 'lucide-react'

type FilterStatus = 'all' | 'not_started' | 'in_progress' | 'completed'

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: 'all',         label: 'すべて' },
  { value: 'not_started', label: '未着手' },
  { value: 'in_progress', label: '作業中' },
  { value: 'completed',   label: '完了' },
]

function getProjectStatus(project: WorkerProject): FilterStatus {
  if (!project.todayJob) return 'not_started'
  if (project.todayJob.status === 'completed') return 'completed'
  return 'in_progress'
}

function StatusChip({ status }: { status: FilterStatus }) {
  if (status === 'completed') return (
    <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-success-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-success-foreground)]">
      <CheckCircle2 className="h-3 w-3" /> 完了
    </span>
  )
  if (status === 'in_progress') return (
    <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-primary-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)]">
      <PlayCircle className="h-3 w-3" /> 作業中
    </span>
  )
  return (
    <span className="flex items-center gap-1 rounded-[var(--radius-full)] bg-[var(--color-muted)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted-foreground)]">
      <Briefcase className="h-3 w-3" /> 未着手
    </span>
  )
}

export default function JobsPage() {
  const [projects, setProjects] = React.useState<WorkerProject[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [filter, setFilter] = React.useState<FilterStatus>('all')

  React.useEffect(() => {
    fetch('/api/jobs', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ data }) => setProjects(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = React.useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.location_name ?? '').toLowerCase().includes(search.toLowerCase())
      const status = getProjectStatus(p)
      const matchFilter = filter === 'all' || status === filter
      return matchSearch && matchFilter
    })
  }, [projects, search, filter])

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="px-4 pt-4 pb-3">
          <h1 className="text-lg font-bold text-[var(--color-foreground)]">案件一覧</h1>
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{projects.length}件の案件</p>
        </div>

        {/* 検索バー */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-muted-foreground)] pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="案件名・作業場所で検索"
              className={cn(
                'h-11 w-full rounded-[var(--radius-lg)] border border-[var(--color-border)]',
                'bg-[var(--color-muted)] pl-9 pr-9 text-sm',
                'placeholder:text-[var(--color-subtle)]',
                'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent'
              )}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* フィルタータブ */}
        <div className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-none">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                'shrink-0 rounded-[var(--radius-full)] px-3.5 py-1.5 text-sm font-medium transition-colors',
                filter === opt.value
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* リスト */}
      <div className="px-4 py-3 space-y-2.5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-[var(--radius-xl)] bg-[var(--color-muted)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Briefcase className="h-10 w-10 text-[var(--color-muted-foreground)] opacity-40 mb-3" />
            <p className="text-sm font-medium text-[var(--color-foreground)]">案件が見つかりません</p>
            {search && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">検索条件を変えてみてください</p>
            )}
          </div>
        ) : (
          filtered.map((project) => {
            const status = getProjectStatus(project)
            return (
              <Link
                key={project.id}
                href={`/jobs/${project.id}`}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--radius-xl)] p-4',
                  'bg-[var(--color-surface)] border',
                  'active:scale-[0.98] transition-transform',
                  status === 'in_progress'
                    ? 'border-[var(--color-primary)]/40 shadow-[0_0_0_1px_var(--color-primary)/10]'
                    : status === 'completed'
                    ? 'border-[var(--color-success)]/30'
                    : 'border-[var(--color-border)]'
                )}
              >
                {/* ステータスアイコン */}
                <span className={cn(
                  'flex h-11 w-11 items-center justify-center rounded-[var(--radius-lg)] shrink-0',
                  status === 'completed'   ? 'bg-[var(--color-success-muted)]' :
                  status === 'in_progress' ? 'bg-[var(--color-primary-muted)]' :
                  'bg-[var(--color-muted)]'
                )}>
                  {status === 'completed'   ? <CheckCircle2 className="h-5.5 w-5.5 text-[var(--color-success)]" /> :
                   status === 'in_progress' ? <PlayCircle   className="h-5.5 w-5.5 text-[var(--color-primary)]"  /> :
                                              <Briefcase    className="h-5.5 w-5.5 text-[var(--color-muted-foreground)]" />}
                </span>

                {/* 情報 */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="font-semibold text-sm truncate text-[var(--color-foreground)]">
                    {project.name}
                  </p>
                  {project.location_name && (
                    <p className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      {project.location_name}
                    </p>
                  )}
                  <StatusChip status={status} />
                </div>

                <ChevronRight className="h-4 w-4 text-[var(--color-muted-foreground)] shrink-0" />
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
