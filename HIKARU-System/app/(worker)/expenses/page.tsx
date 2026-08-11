'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Plus, Clock, CheckCircle2, XCircle, Banknote, ChevronRight,
  Receipt, AlertCircle, Undo2,
} from 'lucide-react'

const GOLD   = 'oklch(0.73 0.12 78)'
const GREEN  = 'oklch(0.72 0.18 150)'
const RED    = 'oklch(0.65 0.22 25)'
const CYAN   = 'oklch(0.85 0.18 198)'
const YELLOW = 'oklch(0.80 0.18 85)'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品',
  consumables: '消耗品', other: 'その他',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft:     { label: '下書き',    color: 'oklch(0.50 0.007 75)', icon: Clock },
  submitted: { label: '申請中',    color: YELLOW, icon: Clock },
  approved:  { label: '承認済み',  color: GREEN,  icon: CheckCircle2 },
  rejected:  { label: '却下',      color: RED,    icon: XCircle },
  settled:   { label: '精算済み',  color: CYAN,   icon: Banknote },
  withdrawn: { label: '取り下げ',  color: 'oklch(0.45 0.005 75)', icon: Undo2 },
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = React.useState<any[]>([])
  const [loading,  setLoading]  = React.useState(true)
  const [filter,   setFilter]   = React.useState<string>('all')

  const fetchExpenses = React.useCallback(async () => {
    setLoading(true)
    try {
      const url = filter === 'all' ? '/api/expenses' : `/api/expenses?status=${filter}`
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const { expenses: data } = await res.json()
        setExpenses(data ?? [])
      }
    } finally { setLoading(false) }
  }, [filter])

  React.useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // 合計金額
  const totalAmount = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const pendingCount = expenses.filter(e => e.status === 'submitted').length

  return (
    <div className="px-4 py-4 space-y-5 pb-24">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>経費申請</h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
            申請中 {pendingCount}件 / 合計 ¥{totalAmount.toLocaleString()}
          </p>
        </div>
        <Link href="/expenses/new">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius-xl)] text-sm font-bold transition-all active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`,
              color: 'oklch(0.06 0.003 260)',
              boxShadow: `0 0 16px ${GOLD}40`,
            }}>
            <Plus className="h-4 w-4" />
            経費を追加
          </button>
        </Link>
      </div>

      {/* フィルタータブ */}
      <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {(['all','draft','submitted','approved','settled','rejected'] as const).map(s => (
          <button key={s}
            onClick={() => setFilter(s)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={filter === s
              ? { background: `${GOLD}22`, border: `1px solid ${GOLD}50`, color: GOLD }
              : { background: 'oklch(0.08 0.003 260)', border: '1px solid oklch(0.15 0.003 260)', color: 'oklch(0.50 0.007 75)' }}>
            { s === 'all' ? 'すべて' : STATUS_CONFIG[s]?.label ?? s }
          </button>
        ))}
      </div>

      {/* 経費リスト */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3"
          style={{ color: 'oklch(0.40 0.005 75)' }}>
          <Receipt className="h-10 w-10 opacity-30" />
          <p className="text-sm">経費がありません</p>
          <Link href="/expenses/new">
            <button className="mt-1 px-4 py-2 rounded-xl text-xs font-bold"
              style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
              経費を追加する
            </button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(exp => {
            const st = STATUS_CONFIG[exp.status] ?? STATUS_CONFIG.draft
            const Icon = st.icon
            return (
              <Link key={exp.id} href={`/expenses/${exp.id}`}>
                <div className="flex items-center gap-3 rounded-[var(--radius-xl)] p-4 transition-all active:scale-[0.98]"
                  style={{
                    background: 'oklch(0.09 0.005 255 / 0.82)',
                    border: `1px solid ${st.color}22`,
                  }}>
                  {/* カテゴリーアイコン */}
                  <div className="h-11 w-11 flex items-center justify-center rounded-[var(--radius-lg)] shrink-0"
                    style={{ background: `${GOLD}10`, border: `1px solid ${GOLD}25` }}>
                    <Receipt className="h-5 w-5" style={{ color: GOLD }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-bold truncate" style={{ color: 'oklch(0.92 0.008 75)' }}>
                        {CATEGORY_LABELS[exp.category] ?? exp.category}
                      </span>
                      <span className="text-base font-black tabular-nums ml-2 shrink-0"
                        style={{ color: GOLD }}>
                        ¥{exp.amount?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px]" style={{ color: 'oklch(0.50 0.007 75)' }}>
                        {exp.expense_date}
                      </span>
                      {exp.projects && (
                        <span className="text-[10px] truncate" style={{ color: 'oklch(0.45 0.005 75)' }}>
                          · {exp.projects.name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Icon className="h-3 w-3 shrink-0" style={{ color: st.color }} />
                      <span className="text-[10px] font-medium" style={{ color: st.color }}>{st.label}</span>
                      {exp.status === 'rejected' && exp.reject_reason && (
                        <span className="text-[10px] truncate" style={{ color: RED }}>
                          · {exp.reject_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.35 0.005 75)' }} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
