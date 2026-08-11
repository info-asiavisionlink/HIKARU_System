'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Clock, Banknote, CalendarDays, Coffee } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function minsToHHMM(mins: number) {
  if (!mins) return '0:00'
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

export default function MonthlyAttendancePage() {
  const { year, month } = useParams<{ year: string; month: string }>()
  const [data, setData]     = React.useState<any[]>([])
  const [summary, setSummary] = React.useState({ totalWorkMins: 0, totalPay: 0, workDays: 0 })
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch(`/api/attendance?mode=monthly&year=${year}&month=${month}`, { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        setData(json.data ?? [])
        setSummary({ totalWorkMins: json.totalWorkMins ?? 0, totalPay: json.totalPay ?? 0, workDays: json.workDays ?? 0 })
        setLoading(false)
      })
  }, [year, month])

  const payMonth = Number(month) === 12
    ? `${Number(year) + 1}年1月`
    : `${year}年${Number(month) + 1}月`

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/attendance" className="p-1.5 rounded-lg" style={{ color: `${GOLD}80` }}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
            {year}年{month}月 勤怠
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
            給与支払: {payMonth}10日
          </p>
        </div>
      </div>

      {/* サマリーカード */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '出勤日数', value: `${summary.workDays}日`, icon: CalendarDays },
          { label: '実働時間', value: minsToHHMM(summary.totalWorkMins), icon: Clock },
          { label: '月間報酬', value: `¥${summary.totalPay.toLocaleString()}`, icon: Banknote },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-3 text-center"
            style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
            <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: `${GOLD}80` }} />
            <p className="text-[10px] mb-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</p>
            <p className="text-sm font-bold" style={{ color: GOLD }}>{value}</p>
          </div>
        ))}
      </div>

      {/* 日別リスト */}
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${GOLD}18` }}>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 rounded-full border-2 animate-spin" style={{ borderColor: `${GOLD}`, borderTopColor: 'transparent' }} />
          </div>
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-sm" style={{ color: 'oklch(0.45 0.006 75)' }}>
            打刻記録がありません
          </div>
        ) : (
          data.map((r, i) => {
            const d = new Date(r.work_date)
            const dayStr = d.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', weekday: 'short' })
            return (
              <div key={r.id} className={`px-4 py-3 ${i > 0 ? 'border-t' : ''}`}
                style={{ borderColor: `${GOLD}12`, background: i % 2 === 0 ? 'oklch(0.09 0.005 255 / 0.85)' : 'oklch(0.07 0.004 255 / 0.60)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>{dayStr}</span>
                  <div className="flex items-center gap-3 text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />{minsToHHMM(r.work_minutes ?? 0)}
                    </span>
                    <span className="font-bold" style={{ color: GOLD }}>¥{(r.daily_pay ?? 0).toLocaleString()}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {[
                    { label: '出勤', val: fmt(r.clock_in) },
                    { label: '休憩開始', val: fmt(r.break_start) },
                    { label: '休憩終了', val: fmt(r.break_end) },
                    { label: '退勤', val: fmt(r.clock_out) },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p style={{ color: 'oklch(0.40 0.005 75)' }}>{label}</p>
                      <p style={{ color: 'oklch(0.75 0.008 75)' }}>{val}</p>
                    </div>
                  ))}
                </div>
                {r.break_minutes > 0 && (
                  <p className="mt-1 text-[10px] flex items-center gap-1" style={{ color: 'oklch(0.45 0.006 75)' }}>
                    <Coffee className="h-3 w-3" />休憩 {minsToHHMM(r.break_minutes)}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
