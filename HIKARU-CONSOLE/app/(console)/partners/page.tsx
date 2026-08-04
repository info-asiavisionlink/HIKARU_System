'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  listPartners,
  partnerStatusLabel,
  partnerStatusOptions,
  type PartnerRow,
  type PartnerStatus,
} from '@/services/partners.service'
import {
  PageHeader, Button, SearchBar, Badge, Skeleton,
  TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Pagination,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, Handshake, Eye } from 'lucide-react'

const PAGE_SIZE = 20

const statusVariant: Record<PartnerStatus, string> = {
  active:     'success',
  suspended:  'warning',
  terminated: 'secondary',
  deleted:    'secondary',
}

export default function PartnersPage() {
  const router = useRouter()
  const [items, setItems]     = React.useState<PartnerRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch]   = React.useState('')
  const [status, setStatus]   = React.useState<PartnerStatus | ''>('')
  const [page, setPage]       = React.useState(1)
  const [total, setTotal]     = React.useState(0)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search, status])
  React.useEffect(() => { fetchData() }, [search, status, page]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    const { data, count } = await listPartners({ search, status, page, pageSize: PAGE_SIZE })
    setItems(data ?? [])
    setTotal(count)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="協力業者管理"
        description={`${total}社の協力業者`}
        actions={
          <Link href="/partners/new">
            <Button><Plus className="h-4 w-4" /> 協力業者を登録</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="会社名・担当者・メールで検索" className="w-72" />
        <Select value={status} onValueChange={(v) => setStatus(v as PartnerStatus | '')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {partnerStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会社名</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>メール</TableHead>
              <TableHead>契約期間</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(7)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>
                  <EmptyState
                    icon={<Handshake className="h-12 w-12" />}
                    title="協力業者が登録されていません"
                    action={
                      <Link href="/partners/new">
                        <Button size="sm"><Plus className="h-4 w-4" /> 協力業者を登録</Button>
                      </Link>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/partners/${p.id}`)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium">{p.company_name}</p>
                      {p.company_name_kana && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">{p.company_name_kana}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{p.contact_person_name ?? '—'}</TableCell>
                  <TableCell>{p.phone ?? '—'}</TableCell>
                  <TableCell>{p.email ?? '—'}</TableCell>
                  <TableCell>
                    {p.contract_start_date || p.contract_end_date
                      ? [
                          p.contract_start_date ? new Date(p.contract_start_date).toLocaleDateString('ja-JP') : '—',
                          p.contract_end_date   ? new Date(p.contract_end_date).toLocaleDateString('ja-JP')   : '—',
                        ].join(' 〜 ')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[p.status] as any}>{partnerStatusLabel[p.status]}</Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => router.push(`/partners/${p.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}社
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
