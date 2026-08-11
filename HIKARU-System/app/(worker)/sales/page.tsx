'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  TrendingUp, Plus, Clock, CheckCircle2, XCircle,
  ChevronRight, Banknote, Target, BarChart3,
} from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const GREEN = 'oklch(0.72 0.18 150)'
const RED   = 'oklch(0.65 0.22 25)'

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending:  { label: '審査中',   color: GOLD,  icon: Clock },
  approved: { label: '承認済み', color: GREEN, icon: CheckCircle2 },
  rejected: { label: '不承認',  color: RED,   icon: XCircle },
}
const TYPE_MAP: Record<string, string> = {
  spot: '単発', recurring: '定期', hotel: 'ホテル', other: 'その他',
}

export default function SalesPage() {
  const today = new Date()
  const [year, setYear]   = React.useState(today.getFullYear())
  const [month, setMonth] = React.useState(today.getMonth() + 1)
  const [stats, setStats]           = React.useState<any>(null)
  const [proposals, setProposals]   = React.useState<any[]>([])
  const [commissions, setCommissions] = React.useState<any[]>([])
  const [loading, setLoading]       = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/sales?year=${year}&month=${month}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        setStats(json.stats ?? {})
        setProposals(json.proposals ?? [])
        setCommissions(json.commissions ?? [])
        setLoading(false)
      })
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  // 今月のみフィルタ
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const monthProposals = proposals.filter(p => {
    const d = p.created_at?.split('T')[0] ?? ''
    return d >= from && d <= to
  })

  return (
    <div className="px-4 py-6 space-y-5 max-w-2xl">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>営業成績</h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>案件提案・成約の実績管理</p>
        </div>
        <Link
          href="/sales/new"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}
        >
          <Plus className="h-4 w-4" />案件提案
        </Link>
      </div>

      {/* 月ナビ */}
      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg border" style={{ borderColor: `${GOLD}30`, color: `${GOLD}80` }}>◀</button>
        <span className="font-bold text-sm" style={{ color: 'oklch(0.88 0.008 75)' }}>{year}年{month}月</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg border" style={{ borderColor: `${GOLD}30`, color: `${GOLD}80` }}>▶</button>
      </div>

      {/* 今月のサマリーカード */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '今月の提案数',    value: `${stats?.monthCount ?? 0}件`,                        icon: TrendingUp,   color: GOLD },
          { label: '今月の承認数',    value: `${stats?.monthApproved ?? 0}件`,                      icon: CheckCircle2, color: GREEN },
          { label: '今月の確定報酬', value: `¥${(stats?.monthCommission ?? 0).toLocaleString()}`, icon: Banknote,     color: GOLD },
          { label: '累計成約率',      value: `${stats?.conversionRate ?? 0}%`,                      icon: Target,       color: GREEN },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
            <Icon className="h-4 w-4 mb-2" style={{ color: `${color}80` }} />
            <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</p>
            <p className="text-xl font-bold" style={{ color }}>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* 今月の提案リスト */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: `${GOLD}80` }}>
          {year}年{month}月の提案
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}18` }}>
          {loading ? (
            <div className="py-10 text-center text-sm" style={{ color: 'oklch(0.45 0.006 75)' }}>読み込み中...</div>
          ) : monthProposals.length === 0 ? (
            <div className="py-10 text-center">
              <BarChart3 className="h-8 w-8 mx-auto mb-2" style={{ color: `${GOLD}30` }} />
              <p className="text-sm" style={{ color: 'oklch(0.45 0.006 75)' }}>この月の提案はありません</p>
              <Link href="/sales/new" className="mt-3 inline-block text-xs" style={{ color: GOLD }}>
                + 案件を提案する
              </Link>
            </div>
          ) : (
            monthProposals.map((p, i) => {
              const st = STATUS_MAP[p.status] ?? STATUS_MAP.pending
              const Icon = st.icon
              return (
                <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                  style={{ borderColor: `${GOLD}12`, background: 'oklch(0.09 0.005 255 / 0.85)' }}>
                  <Icon className="h-4 w-4 shrink-0" style={{ color: st.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'oklch(0.88 0.008 75)' }}>{p.project_name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
                      {p.client_name ?? '—'} · {TYPE_MAP[p.project_type] ?? p.project_type}
                      {p.estimated_amount ? ` · ¥${p.estimated_amount.toLocaleString()}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold shrink-0" style={{ color: st.color }}>{st.label}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 確定報酬一覧 */}
      {commissions.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: `${GOLD}80` }}>
            確定済み営業報酬
          </p>
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}18` }}>
            {commissions.slice(0, 8).map((c: any, i: number) => (
              <div key={c.id} className={`flex items-center justify-between px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: `${GOLD}12`, background: 'oklch(0.09 0.005 255 / 0.85)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'oklch(0.88 0.008 75)' }}>
                    {(c.projects as any)?.name ?? c.project_id}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
                    ¥{c.payment_amount.toLocaleString()} × {(c.commission_rate * 100).toFixed(0)}%
                    {c.period_month && ` (${c.period_month})`}
                    {' · '}{new Date(c.confirmed_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-sm font-bold ml-3 shrink-0" style={{ color: GOLD }}>
                  ¥{c.commission_amount.toLocaleString()}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: `${GOLD}12`, background: 'oklch(0.07 0.004 255 / 0.60)' }}>
              <span className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>累計報酬合計</span>
              <span className="text-base font-bold" style={{ color: GOLD }}>
                ¥{(stats?.totalCommission ?? 0).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 全提案履歴リンク */}
      {proposals.length > monthProposals.length && (
        <div className="rounded-2xl" style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}12` }}>
          <p className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: `${GOLD}80` }}>
            過去の提案（累計 {stats?.totalCount ?? 0}件）
          </p>
          {proposals.filter(p => {
            const d = p.created_at?.split('T')[0] ?? ''
            return d < from || d > to
          }).slice(0, 5).map((p, i) => {
            const st = STATUS_MAP[p.status] ?? STATUS_MAP.pending
            const Icon = st.icon
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: `${GOLD}12` }}>
                <Icon className="h-4 w-4 shrink-0" style={{ color: st.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'oklch(0.80 0.008 75)' }}>{p.project_name}</p>
                  <p className="text-xs" style={{ color: 'oklch(0.45 0.006 75)' }}>
                    {new Date(p.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <span className="text-xs font-bold shrink-0" style={{ color: st.color }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
