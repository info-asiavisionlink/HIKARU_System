'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  listEmployees,
  employeeStatusLabel,
  employeeStatusOptions,
  type EmployeeRow,
  type EmployeeStatus,
} from '@/services/employees.service'
import {
  PageHeader, Button, SearchBar, Badge, Skeleton,
  TableWrapper, Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  Pagination,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, UserCheck, Eye } from 'lucide-react'

const PAGE_SIZE = 20

const statusVariant: Record<EmployeeStatus, string> = {
  active:   'success',
  on_leave: 'warning',
  resigned: 'secondary',
  suspended: 'destructive',
  deleted:  'secondary',
}

const genderLabel: Record<string, string> = { male: '男性', female: '女性', other: 'その他' }

export default function EmployeesPage() {
  const router = useRouter()
  const [items, setItems]   = React.useState<EmployeeRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<EmployeeStatus | ''>('')
  const [page, setPage]     = React.useState(1)
  const [total, setTotal]   = React.useState(0)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  React.useEffect(() => { setPage(1) }, [search, status])
  React.useEffect(() => { fetchData() }, [search, status, page]) // eslint-disable-line

  async function fetchData() {
    setLoading(true)
    const { data, count } = await listEmployees({ search, status, page, pageSize: PAGE_SIZE })
    setItems(data ?? [])
    setTotal(count)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="従業員管理"
        description={`${total}名の従業員`}
        actions={
          <Link href="/employees/new">
            <Button><Plus className="h-4 w-4" /> 従業員を登録</Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar value={search} onChange={setSearch} placeholder="名前・社員番号・メールで検索" className="w-72" />
        <Select value={status} onValueChange={(v) => setStatus(v as EmployeeStatus | '')}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">すべて</SelectItem>
            {employeeStatusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>社員番号</TableHead>
              <TableHead>氏名</TableHead>
              <TableHead>フリガナ</TableHead>
              <TableHead>部署 / 役職</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>入社日</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <TableRow key={i}>
                  {[...Array(8)].map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState
                    icon={<UserCheck className="h-12 w-12" />}
                    title="従業員が登録されていません"
                    action={
                      <Link href="/employees/new">
                        <Button size="sm"><Plus className="h-4 w-4" /> 従業員を登録</Button>
                      </Link>
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((emp) => (
                <TableRow
                  key={emp.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/employees/${emp.id}`)}
                >
                  <TableCell className="font-mono text-xs">
                    {emp.employee_number ?? '—'}
                  </TableCell>
                  <TableCell className="font-medium">{emp.name}</TableCell>
                  <TableCell className="text-[var(--color-muted-foreground)]">
                    {emp.name_kana ?? '—'}
                  </TableCell>
                  <TableCell>
                    {emp.department || emp.position
                      ? [emp.department, emp.position].filter(Boolean).join(' / ')
                      : '—'}
                  </TableCell>
                  <TableCell>{emp.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[emp.status] as any}>
                      {employeeStatusLabel[emp.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {emp.hire_date
                      ? new Date(emp.hire_date).toLocaleDateString('ja-JP')
                      : '—'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => router.push(`/employees/${emp.id}`)}
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
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}名
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  )
}
