'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Calendar, ExternalLink } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'
const CYAN = 'oklch(0.85 0.18 198)'
const PURPLE = 'oklch(0.75 0.15 290)'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function typeColor(type: string) {
  if (type === 'spot')      return GOLD
  if (type === 'recurring') return CYAN
  if (type === 'hotel')     return PURPLE
  return GOLD
}

function typeLabel(type: string) {
  if (type === 'spot')      return '単発'
  if (type === 'recurring') return '定期'
  if (type === 'hotel')     return 'ホテル'
  return type
}

interface Project {
  id: string
  name: string
  project_type: string
  status: string
  start_date: string
  end_date: string
  work_start_time?: string
  work_end_time?: string
  location_name?: string
}

export default function SchedulePage() {
  const today = new Date()
  const [year, setYear] = React.useState(today.getFullYear())
  const [month, setMonth] = React.useState(today.getMonth() + 1) // 1-indexed
  const [projects, setProjects] = React.useState<Project[]>([])
  const [loading, setLoading] = React.useState(true)
  const [gcalUrl, setGcalUrl] = React.useState('')
  const [gcalInput, setGcalInput] = React.useState('')

  React.useEffect(() => {
    setLoading(true)
    fetch(`/api/schedule?year=${year}&month=${month}`, { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ data }) => setProjects(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // カレンダーのセル生成
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const startDow = firstDay.getDay() // 0=日
  const totalDays = lastDay.getDate()

  // カレンダーグリッド（先頭の空白含む）
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ]
  // 6行になるよう末尾を埋める
  while (cells.length % 7 !== 0) cells.push(null)

  // 日付に該当するプロジェクトを返す
  function projectsForDay(day: number): Project[] {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return projects.filter(p => p.start_date <= dateStr && p.end_date >= dateStr)
  }

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  return (
    <div className="max-w-5xl space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>スケジュール</h1>
        <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>担当案件のカレンダービュー</p>
      </div>

      {/* 月ナビゲーション */}
      <div className="flex items-center gap-4">
        <button
          onClick={prevMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
          style={{ background: 'oklch(0.09 0.005 255 / 0.80)', border: `1px solid ${GOLD}20`, color: GOLD }}
          aria-label="前月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-black tabular-nums" style={{ color: 'oklch(0.92 0.008 75)', minWidth: '8rem', textAlign: 'center' }}>
          {year}年 {month}月
        </h2>
        <button
          onClick={nextMonth}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-all"
          style={{ background: 'oklch(0.09 0.005 255 / 0.80)', border: `1px solid ${GOLD}20`, color: GOLD }}
          aria-label="翌月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* 今月ボタン */}
        <button
          onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1) }}
          className="ml-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ background: `${GOLD}14`, border: `1px solid ${GOLD}25`, color: GOLD }}
        >
          今月
        </button>

        {/* 凡例 */}
        <div className="ml-auto hidden sm:flex items-center gap-4">
          {[['spot', '単発'], ['recurring', '定期'], ['hotel', 'ホテル']] .map(([type, lbl]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: typeColor(type) }} />
              <span className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* カレンダー本体 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'oklch(0.08 0.004 260 / 0.90)', border: `1px solid ${GOLD}15` }}>
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7" style={{ borderBottom: `1px solid ${GOLD}12` }}>
          {WEEKDAYS.map((d, i) => (
            <div key={d}
              className="py-2 text-center text-xs font-bold"
              style={{ color: i === 0 ? 'oklch(0.70 0.20 27)' : i === 6 ? 'oklch(0.68 0.20 230)' : 'oklch(0.50 0.007 75)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: GOLD, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              const dayOfWeek = idx % 7
              const dayProjects = day ? projectsForDay(day) : []
              const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
              const todayCell = day ? isToday(day) : false

              return (
                <div
                  key={idx}
                  style={{
                    minHeight: '80px',
                    borderRight: (idx + 1) % 7 !== 0 ? `1px solid ${GOLD}0a` : 'none',
                    borderBottom: idx < cells.length - 7 ? `1px solid ${GOLD}0a` : 'none',
                    background: !day ? 'oklch(0.06 0.003 260 / 0.40)' :
                      todayCell ? `${GOLD}08` : 'transparent',
                    padding: '4px',
                  }}
                >
                  {day && (
                    <>
                      {/* 日付数字 */}
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: todayCell ? 900 : 500,
                          color: todayCell ? 'oklch(0.06 0.003 260)' :
                            dayOfWeek === 0 ? 'oklch(0.70 0.20 27)' :
                            dayOfWeek === 6 ? 'oklch(0.68 0.20 230)' :
                            'oklch(0.70 0.008 75)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '22px',
                          width: '22px',
                          borderRadius: '9999px',
                          background: todayCell ? GOLD : 'transparent',
                          marginBottom: '2px',
                        }}
                      >
                        {day}
                      </div>
                      {/* 案件チップ */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                        {dayProjects.slice(0, 3).map(p => (
                          <Link
                            key={p.id}
                            href={`/jobs/${p.id}`}
                            style={{
                              display: 'block',
                              borderRadius: '3px',
                              padding: '1px 4px',
                              fontSize: '9px',
                              fontWeight: 600,
                              lineHeight: '1.4',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              background: `${typeColor(p.project_type)}22`,
                              color: typeColor(p.project_type),
                              textDecoration: 'none',
                              border: `1px solid ${typeColor(p.project_type)}30`,
                            }}
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                        ))}
                        {dayProjects.length > 3 && (
                          <span style={{ fontSize: '9px', color: 'oklch(0.50 0.007 75)', padding: '0 4px' }}>
                            +{dayProjects.length - 3}件
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 今月の案件リスト */}
      {projects.length > 0 && (
        <section>
          <p className="text-[9px] font-bold uppercase tracking-[0.25em] mb-3" style={{ color: `${GOLD}50` }}>
            {month}月の担当案件
          </p>
          <div className="space-y-2">
            {projects.map(p => {
              const c = typeColor(p.project_type)
              return (
                <Link key={p.id} href={`/jobs/${p.id}`}
                  className="flex items-center gap-3 rounded-xl p-3 transition-all"
                  style={{ background: 'oklch(0.09 0.005 255 / 0.80)', border: `1px solid ${c}18`, textDecoration: 'none' }}>
                  <span className="h-3 w-1 rounded-full shrink-0" style={{ background: c }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'oklch(0.90 0.008 75)' }}>{p.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
                      {p.start_date} 〜 {p.end_date}
                      {p.work_start_time && ` | ${p.work_start_time}${p.work_end_time ? `〜${p.work_end_time}` : ''}`}
                    </p>
                  </div>
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: `${c}18`, color: c }}>
                    {typeLabel(p.project_type)}
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Googleカレンダー連携 */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4" style={{ color: GOLD }} />
          <h2 className="text-sm font-bold" style={{ color: 'oklch(0.88 0.008 75)' }}>Googleカレンダーと連携</h2>
        </div>
        <div className="rounded-2xl p-4 space-y-3" style={{ background: 'oklch(0.09 0.005 255 / 0.82)', border: `1px solid ${GOLD}15` }}>
          <p className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
            GoogleカレンダーのEmbedURLを入力すると、カレンダーが下に表示されます。<br />
            Googleカレンダー設定 → 「カレンダーを統合」→「HTMLコード」からURLを取得してください。
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={gcalInput}
              onChange={e => setGcalInput(e.target.value)}
              placeholder="https://calendar.google.com/calendar/embed?src=..."
              className="flex-1 h-10 rounded-xl px-3 text-xs outline-none"
              style={{ background: 'oklch(0.07 0.004 255 / 0.90)', border: `1px solid ${GOLD}20`, color: 'oklch(0.88 0.008 75)' }}
            />
            <button
              onClick={() => setGcalUrl(gcalInput.trim())}
              className="shrink-0 px-4 h-10 rounded-xl text-sm font-medium transition-all"
              style={{ background: GOLD, color: 'oklch(0.06 0.003 260)', fontWeight: 700 }}
            >
              表示
            </button>
            {gcalUrl && (
              <button
                onClick={() => { setGcalUrl(''); setGcalInput('') }}
                className="shrink-0 px-3 h-10 rounded-xl text-sm font-medium transition-all"
                style={{ background: 'oklch(0.12 0.007 255 / 0.70)', color: 'oklch(0.55 0.007 75)', border: `1px solid ${GOLD}15` }}
              >
                クリア
              </button>
            )}
          </div>

          {gcalUrl && (
            <div className="mt-2 rounded-xl overflow-hidden" style={{ border: `1px solid ${GOLD}18` }}>
              <iframe
                src={gcalUrl}
                title="Googleカレンダー"
                width="100%"
                height="500"
                style={{ display: 'block', border: 'none', background: '#fff' }}
                allowFullScreen
              />
            </div>
          )}

          {!gcalUrl && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'oklch(0.45 0.006 75)' }}>
              <ExternalLink className="h-3.5 w-3.5" />
              URLを入力すると Googleカレンダーが表示されます
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
