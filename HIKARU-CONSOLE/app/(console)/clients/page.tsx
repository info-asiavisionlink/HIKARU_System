'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listClients, deleteClient, type ClientRow } from '@/services/clients.service'
import {
  PageHeader, Button, SearchBar, Badge, Skeleton, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
  Pagination,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import {
  Plus, Building2, MoreHorizontal, Pencil, Trash2, Eye,
  Phone, Mail, User, CheckCircle, XCircle,
} from 'lucide-react'

const PAGE_SIZE = 20

/* ── 顧客カード1件 ── */
function ClientCard({ client, onDelete, onClick, onEdit }: {
  client: ClientRow
  onDelete: (id: string, name: string) => void
  onClick: () => void
  onEdit: () => void
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
      {/* Top glow line (hover) */}
      <div className="absolute top-0 left-8 right-8 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.40), transparent)' }} />

      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* 顧客名 + コード */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] shrink-0"
              style={{ background: 'oklch(0.73 0.12 78 / 0.10)', border: '1px solid oklch(0.73 0.12 78 / 0.25)' }}>
              <Building2 className="h-3.5 w-3.5" style={{ color: 'oklch(0.73 0.12 78)' }} />
            </div>
            <h3 className="text-sm font-semibold truncate" style={{ color: 'oklch(0.93 0.008 75)' }}>
              {client.name}
            </h3>
          </div>

          {/* コード */}
          {client.code && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-[var(--radius-full)] font-semibold"
                style={{
                  background: 'oklch(0.73 0.12 78 / 0.08)',
                  color: 'oklch(0.73 0.12 78 / 0.75)',
                  border: '1px solid oklch(0.73 0.12 78 / 0.20)',
                }}>
                {client.code}
              </span>
            </div>
          )}

          {/* 担当者 */}
          {client.contact_name && (
            <div className="flex items-center gap-1.5 mb-1">
              <User className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.55 0.007 75)' }} />
              <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.008 75)' }}>
                {client.contact_name}
              </span>
            </div>
          )}

          {/* 電話 */}
          {client.phone && (
            <div className="flex items-center gap-1.5 mb-1">
              <Phone className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.55 0.007 75)' }} />
              <span className="text-xs" style={{ color: 'oklch(0.65 0.008 75)' }}>
                {client.phone}
              </span>
            </div>
          )}

          {/* メール */}
          {client.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.55 0.007 75)' }} />
              <span className="text-xs truncate" style={{ color: 'oklch(0.65 0.008 75)' }}>
                {client.email}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* ステータス */}
          <div className="flex items-center gap-1"
            style={{ color: client.is_active ? 'oklch(0.72 0.18 150)' : 'oklch(0.50 0.007 75)' }}>
            {client.is_active
              ? <><CheckCircle className="h-3.5 w-3.5" /><span className="text-[10px] font-semibold">有効</span></>
              : <><XCircle className="h-3.5 w-3.5" /><span className="text-[10px]">無効</span></>
            }
          </div>

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
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" /> 編集
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={() => onDelete(client.id, client.name)}>
                <Trash2 className="h-4 w-4 mr-2" /> 削除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<ClientRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search])
  React.useEffect(() => { fetchClients() }, [search, page]) // eslint-disable-line

  async function fetchClients() {
    setLoading(true)
    try {
      const { data, count, error } = await listClients({ search, page, pageSize: PAGE_SIZE })
      if (error) console.error('[clients] fetch error:', error)
      setItems(data ?? [])
      setTotal(count)
    } catch (e) {
      console.error('[clients] unexpected error:', e)
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteClient(deleteTarget.id)
    if (error) { toast.error('削除に失敗しました'); return }
    toast.success('顧客を削除しました')
    setDeleteTarget(null)
    fetchClients()
  }

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <PageHeader
        title="顧客管理"
        description={`${total}社の顧客`}
        actions={
          <Link href="/clients/new">
            <Button><Plus className="h-4 w-4" /> 新規顧客</Button>
          </Link>
        }
      />

      {/* 検索バー */}
      <div className="mb-5 flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="顧客名・コード・メールで検索"
          className="w-64"
        />
        {!loading && (
          <span className="ml-auto text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
            {total}社
          </span>
        )}
      </div>

      {/* カードグリッド */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="rounded-[var(--radius-lg)] p-4"
              style={{ background: 'oklch(0.09 0.005 255 / 0.82)', border: '1px solid oklch(0.73 0.12 78 / 0.12)' }}>
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-7 w-7 rounded-[var(--radius-sm)]" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="顧客が見つかりません"
          description={search ? '検索条件を変更してみてください' : '新規顧客を追加してください'}
          action={
            !search && (
              <Link href="/clients/new">
                <Button size="sm"><Plus className="h-4 w-4" /> 新規顧客</Button>
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onDelete={(id, name) => setDeleteTarget({ id, name })}
              onClick={() => router.push(`/clients/${client.id}`)}
              onEdit={() => router.push(`/clients/${client.id}/edit`)}
            />
          ))}
        </div>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}社
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`「${deleteTarget?.name}」を削除しますか？`}
        description="この顧客に紐づく店舗・案件データが残っている場合は削除できません。"
      />
    </div>
  )
}
