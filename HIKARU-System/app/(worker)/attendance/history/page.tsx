'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Clock, Banknote, CalendarDays } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

function minsToHHMM(mins: number): string {
  if (!mins) return '0:00'
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`
}

interface MonthSummary {
  year: number
  month: number
  workDays: number
  totalWorkMins: number
  totalPay: number
}

export default function AttendanceHistoryPage() {
  const today = new Date()
  const [months, setMonths] = React.useState<MonthSummary[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    // 直近12ヶ月のサマリーを並列取得
    async function fetchAll() {
      setLoading(true)
      const targets: { year: number; month: number }[] = []
      for (let i = 0; i < 12; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
        targets.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
      }

      const results = await Promise.all(
        targets.map(({ year, month }) =>
          fetch(`/api/attendance?mode=monthly&year=${year}&month=${month}`, { credentials: 'include' })
            .then(r => r.ok ? r.json() : { totalWorkMins: 0, totalPay: 0, workDays: 0 })
            .then(j => ({
              year,
              month,
              workDays:      j.workDays      ?? 0,
              totalWorkMins: j.totalWorkMins ?? 0,
              totalPay:      j.totalPay      ?? 0,
            }))
            .catch(() => ({ year, month, workDays: 0, totalWorkMins: 0, totalPay: 0 }))
        )
      )

      setMonths(results)
      setLoading(false)
    }

    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const totalWorkMins = months.reduce((s, m) => s + m.totalWorkMins, 0)
  const totalPay      = months.reduce((s, m) => s + m.totalPay, 0)
  const totalWorkDays = months.reduce((s, m) => s + m.workDays, 0)

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/attendance" className="p-1.5 rounded-lg" style={{ color: `${GOLD}80` }}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
            全勤怠履歴
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
            直近12ヶ月
          </p>
        </div>
      </div>

      {/* 年間サマリー */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '総出勤日数', value: `${totalWorkDays}日`, icon: CalendarDays },
            { label: '総実働時間', value: minsToHHMM(totalWorkMins),  icon: Clock },
            { label: '総報酬',    value: `¥${totalPay.toLocaleString()}`, icon: Banknote },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-2xl p-3 text-center"
              style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
              <Icon className="h-4 w-4 mx-auto mb-1" style={{ color: `${GOLD}80` }} />
              <p className="text-[9px] mb-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</p>
              <p className="text-sm font-bold" style={{ color: GOLD }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 月別リスト */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
        <p className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>
          月別一覧
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 rounded-full border-2 animate-spin"
              style={{ borderColor: GOLD, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          months.map(({ year, month, workDays, totalWorkMins, totalPay }) => (
            <Link
              key={`${year}-${month}`}
              href={`/attendance/${year}/${month}`}
              className="flex items-center justify-between px-4 py-3 border-t transition-colors"
              style={{ borderColor: `${GOLD}12` }}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 shrink-0" style={{ color: `${GOLD}80` }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'oklch(0.80 0.008 75)' }}>
                    {year}年{month}月
                  </p>
                  {workDays > 0 && (
                    <p className="text-[10px]" style={{ color: 'oklch(0.48 0.006 75)' }}>
                      {workDays}日出勤 / {minsToHHMM(totalWorkMins)}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {workDays > 0 ? (
                  <span className="text-sm font-bold" style={{ color: GOLD }}>
                    ¥{totalPay.toLocaleString()}
                  </span>
                ) : (
                  <span className="text-xs" style={{ color: 'oklch(0.38 0.005 75)' }}>記録なし</span>
                )}
                <ChevronRight className="h-4 w-4" style={{ color: `${GOLD}60` }} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
