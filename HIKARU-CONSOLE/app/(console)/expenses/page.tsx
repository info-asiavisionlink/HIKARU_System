'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  PageHeader, Breadcrumb, Button,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { CheckCircle2, XCircle, Clock, Banknote, Receipt, ChevronRight } from 'lucide-react'

const GOLD   = 'oklch(0.73 0.12 78)'
const GREEN  = 'oklch(0.72 0.18 150)'
const RED    = 'oklch(0.65 0.22 25)'
const CYAN   = 'oklch(0.85 0.18 198)'
const YELLOW = 'oklch(0.80 0.18 85)'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
}
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: '下書き',   color: 'oklch(0.45 0.005 75)', icon: Clock },
  submitted: { label: '申請中',   color: YELLOW, icon: Clock },
  approved:  { label: '承認済み', color: GREEN,  icon: CheckCircle2 },
  rejected:  { label: '却下',     color: RED,    icon: XCircle },
  settled:   { label: '精算済み', color: CYAN,   icon: Banknote },
  withdrawn: { label: '取り下げ', color: 'oklch(0.40 0.005 75)', icon: Clock },
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = React.useState<any[]>([])
  const [kpi,      setKpi]      = React.useState<any>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [settling, setSettling] = React.useState(false)
  const [filters,  setFilters]  = React.useState({ status: '', category: '', date_from: '', date_to: '' })

  function upd(k: string, v: string) { setFilters(p => ({ ...p, [k]: v })) }

  const fetchExpenses = React.useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.status)    params.set('status',    filters.status)
      if (filters.category)  params.set('category',  filters.category)
      if (filters.date_from) params.set('date_from', filters.date_from)
      if (filters.date_to)   params.set('date_to',   filters.date_to)

      const res = await fetch(`/api/expenses?${params}`, { credentials: 'include' })
      if (res.ok) {
        const { expenses: data, kpi: kpiData } = await res.json()
        setExpenses(data ?? [])
        setKpi(kpiData)
      }
    } finally {
      setLoading(false)
    }
  }, [filters])

  React.useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function bulkSettle() {
    const approved = expenses.filter(e => e.status === 'approved')
    if (approved.length === 0) return
    if (!confirm(`承認済み ${approved.length}件を一括精算しますか？`)) return

    setSettling(true)
    for (const exp of approved) {
      await fetch(`/api/expenses/${exp.id}/settle`, { method: 'POST', credentials: 'include' })
    }
    setSettling(false)
    fetchExpenses()
  }

  const approvedExpenses = expenses.filter(e => e.status === 'approved')
  const totalSettleAmount = approvedExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="経費管理"
        breadcrumb={<Breadcrumb items={[{ label: '経費管理' }]} />}
      />

      {/* KPI カード */}
      {kpi && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: '承認待ち',   value: kpi.submitted, amount: kpi.submitted_amount, color: YELLOW },
            { label: '承認済み',   value: kpi.approved,  amount: kpi.approved_amount,  color: GREEN },
            { label: '精算済み',   value: kpi.settled,   amount: kpi.settled_amount,   color: CYAN },
            { label: '却下',       value: kpi.rejected,  amount: null,                 color: RED },
          ].map(k => (
            <div key={k.label} className="rounded-[var(--radius-lg)] p-4"
              style={{ background: `${k.color}08`, border: `1px solid ${k.color}22` }}>
              <p className="text-xs font-medium mb-1" style={{ color: k.color }}>{k.label}</p>
              <p className="text-2xl font-black" style={{ color: 'oklch(0.92 0.008 75)' }}>{k.value}件</p>
              {k.amount != null && (
                <p className="text-xs mt-0.5 tabular-nums" style={{ color: 'oklch(0.55 0.007 75)' }}>
                  ¥{k.amount.toLocaleString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* フィルター */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>ステータス</label>
          <Select value={filters.status || 'all'} onValueChange={v => upd('status', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="すべて" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>カテゴリー</label>
          <Select value={filters.category || 'all'} onValueChange={v => upd('category', v === 'all' ? '' : v)}>
            <SelectTrigger><SelectValue placeholder="すべて" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>開始日</label>
          <input type="date" value={filters.date_from} onChange={e => upd('date_from', e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--radius)] text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
        </div>
        <div>
          <label className="mb-1 block text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>終了日</label>
          <input type="date" value={filters.date_to} onChange={e => upd('date_to', e.target.value)}
            className="w-full px-3 py-2 rounded-[var(--radius)] text-sm outline-none"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', color: 'var(--color-foreground)' }} />
        </div>
      </div>

      {/* 一括精算 */}
      {approvedExpenses.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-[var(--radius-lg)] mb-4"
          style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}30` }}>
          <p className="text-sm" style={{ color: GREEN }}>
            承認済み {approvedExpenses.length}件 / 合計 ¥{totalSettleAmount.toLocaleString()} を精算できます
          </p>
          <Button size="sm" onClick={bulkSettle} disabled={settling}>
            {settling ? '精算中...' : '一括精算'}
          </Button>
        </div>
      )}

      {/* 経費リスト */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2" style={{ color: 'oklch(0.40 0.005 75)' }}>
          <Receipt className="h-10 w-10 opacity-30" />
          <p className="text-sm">経費がありません</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)]"
          style={{ border: '1px solid oklch(0.15 0.003 260)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'oklch(0.08 0.003 260)', borderBottom: '1px solid oklch(0.15 0.003 260)' }}>
                {['申請者', '種別', '発生日', 'カテゴリー', '金額', '案件', '領収書', '申請日', 'ステータス', ''].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold"
                    style={{ color: 'oklch(0.50 0.007 75)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => {
                const st = STATUS_CONFIG[exp.status] ?? STATUS_CONFIG.draft
                const Icon = st.icon
                return (
                  <tr key={exp.id}
                    style={{ borderBottom: '1px solid oklch(0.10 0.002 260)', background: i % 2 ? 'transparent' : 'oklch(0.05 0.002 260 / 0.3)' }}>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-xs" style={{ color: 'oklch(0.85 0.008 75)' }}>
                        {exp.profile?.name ?? '—'}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'oklch(0.15 0.003 260)', color: 'oklch(0.60 0.007 75)' }}>
                        {exp.assignee_type === 'employee' ? '従業員' : exp.assignee_type === 'partner' ? '協力業者' : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums" style={{ color: 'oklch(0.70 0.007 75)' }}>
                      {exp.expense_date}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: 'oklch(0.70 0.007 75)' }}>
                      {CATEGORY_LABELS[exp.category] ?? exp.category}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold tabular-nums" style={{ color: GOLD }}>
                      ¥{exp.amount?.toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-xs max-w-[120px] truncate" style={{ color: 'oklch(0.60 0.007 75)' }}>
                      {exp.projects?.name ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {exp.expense_receipts?.length > 0
                        ? <Receipt className="h-3.5 w-3.5" style={{ color: GOLD }} />
                        : <span className="text-xs" style={{ color: 'oklch(0.35 0.005 75)' }}>なし</span>
                      }
                    </td>
                    <td className="px-3 py-2.5 text-xs tabular-nums" style={{ color: 'oklch(0.55 0.007 75)' }}>
                      {exp.submitted_at ? new Date(exp.submitted_at).toLocaleDateString('ja-JP') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: st.color }}>
                        <Icon className="h-3 w-3" />
                        {st.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/expenses/${exp.id}`}>
                        <ChevronRight className="h-4 w-4" style={{ color: 'oklch(0.40 0.005 75)' }} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
