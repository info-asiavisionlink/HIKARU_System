'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { listStores, deleteStore } from '@/services/stores.service'
import {
  PageHeader, Button, SearchBar, Badge, Skeleton,
  TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Pagination, toast,
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import { Plus, Store, MoreHorizontal, Pencil, Trash2, Eye, MapPin } from 'lucide-react'

const PAGE_SIZE = 20

export default function StoresPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search])
  React.useEffect(() => { fetchStores() }, [search, page]) // eslint-disable-line

  async function fetchStores() {
    setLoading(true)
    const { data, count } = await listStores({ search, page, pageSize: PAGE_SIZE })
    setItems(data ?? [])
    setTotal(count)
    setLoading(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteStore(deleteTarget.id)
    if (error) { toast.error('削除に失敗しました。案件が残っている場合は削除できません。'); return }
    toast.success('店舗を削除しました')
    fetchStores()
  }

  return (
    <div>
      <PageHeader
        title="店舗管理"
        description={`${total}店舗`}
        actions={
          <Link href="/stores/new">
            <Button><Plus className="h-4 w-4" /> 新規店舗</Button>
          </Link>
        }
      />

      <div className="mb-4">
        <SearchBar value={search} onChange={setSearch} placeholder="店舗名・コード・住所で検索" className="w-72" />
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>店舗名</TableHead>
              <TableHead>店舗コード</TableHead>
              <TableHead>顧客</TableHead>
              <TableHead>住所</TableHead>
              <TableHead>責任者</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>{[...Array(8)].map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<Store className="h-12 w-12" />}
                    title="店舗が見つかりません"
                    action={<Link href="/stores/new"><Button size="sm"><Plus className="h-4 w-4" /> 新規店舗</Button></Link>}
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((store) => (
                <TableRow key={store.id} className="cursor-pointer" onClick={() => router.push(`/stores/${store.id}`)}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell>
                    {store.code ? <Badge variant="secondary">{store.code}</Badge> : '—'}
                  </TableCell>
                  <TableCell>{store.clients?.name ?? '—'}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1.5 text-sm">
                      {store.address ? <><MapPin className="h-3.5 w-3.5 text-[var(--color-muted-foreground)] shrink-0" /><span className="truncate max-w-[160px]">{store.address}</span></> : '—'}
                    </span>
                  </TableCell>
                  <TableCell>{store.manager_name ?? '—'}</TableCell>
                  <TableCell>{store.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={store.is_active ? 'success' : 'secondary'} size="sm">
                      {store.is_active ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/stores/${store.id}`)}>
                          <Eye className="h-4 w-4 mr-2" /> 詳細
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/stores/${store.id}/edit`)}>
                          <Pencil className="h-4 w-4 mr-2" /> 編集
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-[var(--color-error)]"
                          onClick={() => setDeleteTarget({ id: store.id, name: store.name })}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> 削除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}件</p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`「${deleteTarget?.name}」を削除しますか？`}
        description="この店舗に紐づく案件が残っている場合は削除できません。"
      />
    </div>
  )
}
