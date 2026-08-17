'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Clock, Zap, RefreshCw, Hotel } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const GOLD   = 'oklch(0.73 0.12 78)'
const CYAN   = 'oklch(0.85 0.18 198)'
const PURPLE = 'oklch(0.75 0.15 290)'

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

function typeColor(t: string) {
  if (t === 'recurring') return CYAN
  if (t === 'hotel')     return PURPLE
  return GOLD
}

function addDays(d: Date, n: number) {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

interface Shift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  projects: { id: string; name: string; location_name: string | null; project_type: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '予定', confirmed: '確定', in_progress: '作業中', completed: '完了',
}

export default function SchedulePage() {
  const today    = new Date()
  const [baseDate, setBaseDate] = React.useState(today)
  const [shifts,   setShifts]   = React.useState<Shift[]>([])
  const [loading,  setLoading]  = React.useState(true)
  const [realtimeConnected, setRealtimeConnected] = React.useState(false)

  // 週の範囲
  const weekDates = React.useMemo(() => {
    const day = baseDate.getDay()
    const mon = addDays(baseDate, -day + (day === 0 ? -6 : 1))
    return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  }, [baseDate])

  const dateFrom = formatDate(weekDates[0])
  const dateTo   = formatDate(weekDates[6])

  const fetchShifts = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/shifts?date_from=${dateFrom}&date_to=${dateTo}`, { credentials: 'include' })
      if (res.ok) {
        const { shifts: data } = await res.json()
        setShifts(data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  React.useEffect(() => { fetchShifts() }, [fetchShifts])

  // Supabase Realtime: 自分のシフトが変更されたら自動更新
  React.useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => { fetchShifts() }
      )
      .subscribe(status => {
        setRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => { supabase.removeChannel(channel) }
  }, [fetchShifts])

  const todayStr = formatDate(today)

  // 日付ごとのシフトMap
  const shiftsByDate = React.useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of shifts) {
      if (!map[s.shift_date]) map[s.shift_date] = []
      map[s.shift_date].push(s)
    }
    return map
  }, [shifts])

  const monthLabel = `${baseDate.getFullYear()}年${baseDate.getMonth()+1}月`

  return (
    <div className="px-4 py-4 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>スケジュール</h1>
        <div className="flex items-center gap-1">
          {/* Realtime インジケーター */}
          <span className={`h-1.5 w-1.5 rounded-full ${realtimeConnected ? 'animate-pulse' : ''}`}
            style={{ background: realtimeConnected ? 'oklch(0.72 0.18 150)' : 'oklch(0.35 0.005 75)' }} />
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'oklch(0.40 0.005 75)' }}>
            {realtimeConnected ? 'LIVE' : 'connecting'}
          </span>
        </div>
      </div>

      {/* 週ナビゲーション */}
      <div className="flex items-center justify-between">
        <button onClick={() => setBaseDate(d => addDays(d, -7))}
          className="p-2 rounded-[var(--radius)] transition-all"
          style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold" style={{ color: 'oklch(0.80 0.008 75)' }}>{monthLabel}</span>
        <button onClick={() => setBaseDate(d => addDays(d, 7))}
          className="p-2 rounded-[var(--radius)] transition-all"
          style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30`, color: GOLD }}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 曜日カレンダー */}
      <div className="grid grid-cols-7 gap-1">
        {weekDates.map(d => {
          const ds       = formatDate(d)
          const isToday  = ds === todayStr
          const dayShifts = shiftsByDate[ds] ?? []
          const hasBoth  = dayShifts.some(s => s.status === 'confirmed')

          return (
            <div key={ds} className="flex flex-col items-center gap-1">
              <span className="text-[9px]" style={{ color: 'oklch(0.45 0.005 75)' }}>
                {WEEKDAYS[d.getDay()]}
              </span>
              <div
                className="h-9 w-9 flex items-center justify-center rounded-full text-sm font-bold transition-all"
                style={isToday ? {
                  background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`,
                  color: 'oklch(0.06 0.003 260)',
                  boxShadow: `0 0 12px ${GOLD}50`,
                } : {
                  color: dayShifts.length > 0 ? 'oklch(0.88 0.008 75)' : 'oklch(0.50 0.007 75)',
                }}>
                {d.getDate()}
              </div>
              {/* シフトドット */}
              <div className="flex gap-0.5 h-2 items-center justify-center">
                {dayShifts.slice(0,3).map((_, i) => (
                  <span key={i} className="h-1 w-1 rounded-full"
                    style={{ background: hasBoth ? CYAN : GOLD }} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* シフト詳細リスト */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map(d => {
            const ds = formatDate(d)
            const dayShifts = shiftsByDate[ds] ?? []
            const isToday = ds === todayStr
            const isPast  = d < today && !isToday

            return (
              <div key={ds}
                className="rounded-[var(--radius-xl)] overflow-hidden"
                style={{
                  border: isToday ? `1px solid ${GOLD}35` : '1px solid oklch(0.12 0.003 260)',
                  background: isToday ? `${GOLD}05` : 'oklch(0.07 0.003 260)',
                  opacity: isPast ? 0.65 : 1,
                }}>
                {/* 日付行 */}
                <div className="flex items-center gap-2 px-3 py-2"
                  style={{ borderBottom: dayShifts.length > 0 ? '1px solid oklch(0.12 0.003 260)' : 'none' }}>
                  <span className="text-xs font-bold"
                    style={{ color: isToday ? GOLD : 'oklch(0.60 0.007 75)' }}>
                    {d.getMonth()+1}/{d.getDate()} ({WEEKDAYS[d.getDay()]})
                  </span>
                  {isToday && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${GOLD}20`, color: GOLD }}>TODAY</span>
                  )}
                </div>

                {/* シフトカード */}
                {dayShifts.length === 0 ? (
                  <p className="px-3 py-2 text-xs" style={{ color: 'oklch(0.32 0.005 75)' }}>—</p>
                ) : dayShifts.map(shift => {
                  const col = typeColor(shift.projects?.project_type ?? '')
                  const isConfirmed = shift.status === 'confirmed'

                  return (
                    <div key={shift.id} className="px-3 py-3 space-y-1.5"
                      style={{ borderTop: '1px solid oklch(0.10 0.003 260)' }}>
                      {/* 時間 + ステータス */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" style={{ color: col }} />
                          <span className="text-xs font-bold tabular-nums" style={{ color: col }}>
                            {shift.start_time.slice(0,5)} 〜 {shift.end_time.slice(0,5)}
                          </span>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: isConfirmed ? `${CYAN}18` : `${GOLD}15`,
                            color: isConfirmed ? CYAN : GOLD,
                          }}>
                          {STATUS_LABEL[shift.status] ?? shift.status}
                        </span>
                      </div>

                      {/* 案件名 */}
                      <p className="text-sm font-semibold" style={{ color: 'oklch(0.92 0.008 75)' }}>
                        {shift.projects?.name ?? '—'}
                      </p>

                      {/* 場所 */}
                      {shift.projects?.location_name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.45 0.005 75)' }} />
                          <span className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                            {shift.projects.location_name}
                          </span>
                        </div>
                      )}

                      {/* 備考 */}
                      {shift.notes && (
                        <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{shift.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {shifts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 gap-2"
              style={{ color: 'oklch(0.38 0.005 75)' }}>
              <CalendarDays className="h-8 w-8 opacity-30" />
              <p className="text-sm">この週にシフトはありません</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
