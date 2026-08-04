'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listProjects, deleteProject, type ProjectStatus } from '@/services/projects.service'
import {
  PageHeader, Button, SearchBar, StatusBadge,
  Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  Pagination,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import {
  Plus, FolderOpen, MoreHorizontal, Pencil, Trash2, Eye,
  MapPin, Calendar, Hash, Zap, RefreshCw, Hotel,
} from 'lucide-react'

const TYPE_OPTIONS = [
  { value: '',          label: 'すべて',     icon: FolderOpen },
  { value: 'spot',      label: '単発',       icon: Zap },
  { value: 'recurring', label: '定期',       icon: RefreshCw },
  { value: 'hotel',     label: 'ホテル',     icon: Hotel },
]

const typeLabel: Record<string, string> = { spot: '単発', recurring: '定期', hotel: 'ホテル' }
const typeVariant: Record<string, string> = { spot: 'info', recurring: 'warning', hotel: 'secondary' }

const PAGE_SIZE = 20

const STATUS_OPTIONS: { value: ProjectStatus | ''; label: string }[] = [
  { value: '',          label: 'すべて' },
  { value: 'active',    label: '稼働中' },
  { value: 'paused',    label: '停止中' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
]

/* ── カード1件 ── */
function ProjectCard({ project, onDelete, onClick }: {
  project: any
  onDelete: (id: string, name: string) => void
  onClick: () => void
}) {
  return (
    <div
      className="relative rounded-[var(--radius-lg)] p-4 cursor-pointer transition-all duration-200 group"
      style={{
        background: 'oklch(0.09 0.005 255 / 0.82)',
        backdropFilter: 'blur(20px)',
        border: '1px solid oklch(0.73 0.12 78 / 0.18)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.73 0.12 78 / 0.40)'
        e.currentTarget.style.boxShadow = '0 0 20px oklch(0.73 0.12 78 / 0.08)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'oklch(0.73 0.12 78 / 0.18)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Top glow line */}
      <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.40), transparent)' }} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* 案件名 */}
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-sm font-semibold truncate" style={{ color: 'oklch(0.93 0.008 75)' }}>
              {project.name}
            </h3>
            {project.code && (
              <span className="shrink-0 rounded-[var(--radius-full)] px-2 py-0.5 text-[10px] font-semibold"
                style={{
                  background: 'oklch(0.73 0.12 78 / 0.10)',
                  color: 'oklch(0.73 0.12 78 / 0.80)',
                  border: '1px solid oklch(0.73 0.12 78 / 0.25)',
                }}>
                {project.code}
              </span>
            )}
          </div>

          {/* 場所 */}
          {project.location_name && (
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.73 0.12 78 / 0.60)' }} />
              <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.008 75)' }}>
                {project.location_name}
              </span>
            </div>
          )}

          {/* 開始日 */}
          {project.start_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.55 0.007 75)' }} />
              <span className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                {new Date(project.start_date).toLocaleDateString('ja-JP')}
                {project.end_date && ` 〜 ${new Date(project.end_date).toLocaleDateString('ja-JP')}`}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge status={project.status} type="project" />
          {/* メニュー */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-[var(--radius-sm)] p-1 transition-all duration-150 opacity-0 group-hover:opacity-100 focus:opacity-100"
                style={{ color: 'oklch(0.55 0.007 75)' }}
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'oklch(0.73 0.12 78)'; e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)' }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'oklch(0.55 0.007 75)'; e.currentTarget.style.background = 'transparent' }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onClick}>
                <Eye className="h-4 w-4 mr-2" /> 詳細
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { /* 編集は別途 */ }}>
                <Pencil className="h-4 w-4 mr-2" /> 編集
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => onDelete(project.id, project.name)}>
                <Trash2 className="h-4 w-4 mr-2" /> 削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<ProjectStatus | ''>('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search, status])
  React.useEffect(() => { fetchProjects() }, [search, status, page]) // eslint-disable-line

  async function fetchProjects() {
    setLoading(true)
    try {
      const { data, count, error } = await listProjects({ search, status, page, pageSize: PAGE_SIZE })
      if (error) console.error('[projects] fetch error:', error)
      setItems(data ?? [])
      setTotal(count)
    } catch (e) {
      console.error('[projects] unexpected error:', e)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteProject(deleteTarget.id)
    if (error) {
      toast.error('削除に失敗しました')
    } else {
      toast.success('案件を削除しました')
      setDeleteTarget(null)
      fetchProjects()
    }
  }

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <PageHeader
        title="案件管理"
        description={`${total}件の案件`}
        actions={
          <Link href="/projects/new">
            <Button><Plus className="h-4 w-4" /> 新規案件</Button>
          </Link>
        }
      />

      {/* フィルターバー */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="案件名・コード・場所で検索"
          className="w-64"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = status === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setStatus(opt.value)}
                className="rounded-[var(--radius-full)] px-3 py-1.5 text-xs font-semibold transition-all duration-200"
                style={isActive ? {
                  background: 'linear-gradient(135deg, oklch(0.52 0.10 75), oklch(0.82 0.13 78))',
                  color: 'oklch(0.06 0.003 260)',
                  boxShadow: '0 0 12px oklch(0.73 0.12 78 / 0.40)',
                } : {
                  background: 'oklch(0.11 0.006 255 / 0.80)',
                  color: 'oklch(0.60 0.008 75)',
                  border: '1px solid oklch(0.73 0.12 78 / 0.15)',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        {/* 件数表示 */}
        {!loading && (
          <span className="ml-auto text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
            {total}件
          </span>
        )}
      </div>

      {/* カードグリッド */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] p-4"
              style={{ background: 'oklch(0.09 0.005 255 / 0.82)', border: '1px solid oklch(0.73 0.12 78 / 0.12)' }}>
              <div className="space-y-2.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-12 w-12" />}
          title="案件が見つかりません"
          description={search || status ? '検索条件を変更してみてください' : '新規案件を追加してください'}
          action={
            !search && !status && (
              <Link href="/projects/new">
                <Button size="sm"><Plus className="h-4 w-4" /> 新規案件</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onClick={() => router.push(`/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}件
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`「${deleteTarget?.name}」を削除しますか？`}
        description="案件に紐づくマニュアル等のデータも削除されます。この操作は取り消せません。"
      />
    </div>
  )
}
