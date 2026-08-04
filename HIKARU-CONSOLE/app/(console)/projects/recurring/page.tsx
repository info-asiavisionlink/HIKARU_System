'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHeader, Button, SearchBar, Badge, Skeleton, TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Pagination, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, RefreshCw, Eye } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: '', label: 'すべて' }, { value: 'active', label: '稼働中' },
  { value: 'paused', label: '停止中' }, { value: 'completed', label: '完了' },
]

const cycleLabel: Record<string, string> = {
  daily: '毎日', weekly: '毎週', monthly: '毎月', biweekly: '隔週',
  nth_weekday: '第○曜日', custom: 'カスタム',
}
const statusVariant: Record<string, string> = { active: 'success', paused: 'warning', completed: 'secondary', cancelled: 'destructive' }
const statusLabel: Record<string, string>  = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
const PAGE_SIZE = 20

export default function RecurringProjectsPage() {
  const router = useRouter()
  const [items, setItems]   = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState('')
  const [page, setPage]     = React.useState(1)
  const [total, setTotal]   = React.useState(0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search, status])
  React.useEffect(() => { fetchData() }, [search, status, page]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    const p = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (search) p.set('search', search)
    if (status) p.set('status', status)
    const res = await fetch(`/api/projects/recurring?${p}`, { credentials: 'include', cache: 'no-store' })
    if (res.ok) { const { data, count } = await res.json(); setItems(data ?? []); setTotal(count ?? 0) }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="定期案件"
        description={`${total}件 ／ 毎日・毎週・毎月の繰り返し清掃`}
        actions={<Link href="/projects/recurring/new"><Button><Plus className="h-4 w-4" /> 定期案件を登録</Button></Link>}
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="案件名で検索" className="w-64" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="ステータス" /></SelectTrigger>
          <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件名</TableHead><TableHead>顧客</TableHead>
              <TableHead>作業周期</TableHead><TableHead>期間</TableHead>
              <TableHead>必要人数</TableHead><TableHead>ステータス</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? [...Array(6)].map((_, i) => (
              <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : items.length === 0 ? (
              <TableRow><TableCell colSpan={7}>
                <EmptyState icon={<RefreshCw className="h-12 w-12" />} title="定期案件がありません"
                  action={<Link href="/projects/recurring/new"><Button size="sm"><Plus className="h-4 w-4" /> 登録する</Button></Link>} />
              </TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id} className="cursor-pointer" onClick={() => router.push(`/projects/recurring/${item.id}`)}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.clients?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="info">{cycleLabel[item.recurring_project_details?.cycle_type ?? ''] ?? '—'}</Badge>
                </TableCell>
                <TableCell>
                  {[item.start_date, item.end_date].filter(Boolean).map((d: string) => new Date(d).toLocaleDateString('ja-JP', {year:'numeric',month:'short',day:'numeric'})).join(' 〜 ') || '—'}
                </TableCell>
                <TableCell>{item.recurring_project_details?.required_staff ?? '—'}名</TableCell>
                <TableCell><Badge variant={statusVariant[item.status] as any}>{statusLabel[item.status]}</Badge></TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/projects/recurring/${item.id}`)}><Eye className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE,total)} / {total}件</p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
