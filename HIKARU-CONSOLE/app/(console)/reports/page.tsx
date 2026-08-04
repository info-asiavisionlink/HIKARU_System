'use client'

import * as React from 'react'
import Link from 'next/link'
import { listReports, getReportStats, type ReportListItem } from '@/services/reports.service'
import {
  PageHeader, Skeleton, Pagination,
  TableWrapper, Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
  ScoreBadge,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import {
  FileText, Eye, CalendarDays, BarChart3,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

const PAGE_SIZE = 20

function ScoreChip({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[var(--color-muted-foreground)]">—</span>
  return <ScoreBadge score={score} showLabel={false} size="sm" />
}

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-muted)]">
        <Icon className="h-5 w-5 text-[var(--color-primary)]" />
      </div>
      <div>
        <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
        <p className="text-xl font-bold text-[var(--color-foreground)]">{value}</p>
        {sub && <p className="text-xs text-[var(--color-muted-foreground)]">{sub}</p>}
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const [items, setItems]   = React.useState<ReportListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage]     = React.useState(1)
  const [total, setTotal]   = React.useState(0)
  const [stats, setStats]   = React.useState({ totalReports: 0, avgScore: null as number | null, thisMonthCount: 0 })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => {
    fetchReports()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  React.useEffect(() => {
    getReportStats().then(setStats)
  }, [])

  async function fetchReports() {
    setLoading(true)
    const { data, count } = await listReports({ page, pageSize: PAGE_SIZE })
    setItems(data)
    setTotal(count)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="報告書管理"
        description={`${total}件の報告書`}
      />

      {/* 統計カード */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard icon={FileText}    label="総報告書数"    value={`${stats.totalReports}件`} />
        <StatCard icon={BarChart3}   label="平均品質スコア" value={stats.avgScore != null ? `${stats.avgScore}点` : '—'} />
        <StatCard icon={CalendarDays} label="今月の報告書"  value={`${stats.thisMonthCount}件`} />
      </div>

      {/* テーブル */}
      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>作業日</TableHead>
              <TableHead>案件名</TableHead>
              <TableHead>店舗</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead className="text-center">スコア</TableHead>
              <TableHead className="text-center">Ver.</TableHead>
              <TableHead>生成日時</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-12">
                  <EmptyState
                    icon={<FileText className="h-10 w-10" />}
                    title="報告書がありません"
                    description="作業者がAI報告書を生成すると、こちらに表示されます"
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id} className="hover:bg-[var(--color-muted)]/40">
                  <TableCell className="whitespace-nowrap text-sm">
                    {item.jobs?.work_date
                      ? new Date(item.jobs.work_date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm text-[var(--color-foreground)] truncate max-w-[160px]">
                        {(item.projects as any)?.name ?? '—'}
                      </p>
                      {(item.projects as any)?.code && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">{(item.projects as any).code}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)] truncate max-w-[120px]">
                    {(item.projects as any)?.stores?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)]">
                    {(item.profiles as any)?.name ?? '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    <ScoreChip score={item.overall_score} />
                  </TableCell>
                  <TableCell className="text-center text-sm text-[var(--color-muted-foreground)]">
                    v{item.version}
                  </TableCell>
                  <TableCell className="text-sm text-[var(--color-muted-foreground)] whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/reports/${item.id}`}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-[var(--radius-lg)] px-3 py-1.5',
                        'text-xs font-medium text-[var(--color-primary)]',
                        'border border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]',
                        'hover:bg-[var(--color-primary)]/15 transition-colors'
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" /> 表示
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* ページネーション */}
      {totalPages > 1 && (
        <div className="mt-4 flex justify-center">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  )
}
