'use client'

import * as React from 'react'
import Link from 'next/link'
import { LogIn, Coffee, PlayCircle, LogOut, Clock, ChevronRight, Loader2 } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

type AttendanceRecord = {
  id: string
  work_date: string
  clock_in:    string | null
  break_start: string | null
  break_end:   string | null
  clock_out:   string | null
  break_minutes: number
  work_minutes:  number
  hourly_rate:   number
  daily_pay:     number
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function minsToHHMM(mins: number): string {
  if (!mins) return '0:00'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}:${String(m).padStart(2, '0')}`
}

type PunchType = 'clock_in' | 'break_start' | 'break_end' | 'clock_out'

export default function AttendancePage() {
  const [record, setRecord]   = React.useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [punching, setPunching] = React.useState<PunchType | null>(null)
  const [now, setNow]         = React.useState(new Date())
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchToday()
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  async function fetchToday() {
    setLoading(true)
    const res  = await fetch('/api/attendance?mode=today', { credentials: 'include' })
    const json = await res.json()
    setRecord(json.data)
    setLoading(false)
  }

  async function punch(type: PunchType) {
    setPunching(type)
    setMessage(null)
    const res  = await fetch('/api/attendance/punch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      credentials: 'include',
    })
    const json = await res.json()
    if (res.ok) {
      setRecord(json.data)
      const labels: Record<PunchType, string> = {
        clock_in:    '出勤しました',
        break_start: '休憩を開始しました',
        break_end:   '休憩を終了しました',
        clock_out:   '退勤しました',
      }
      setMessage(labels[type])
    } else {
      setMessage('エラーが発生しました')
    }
    setPunching(null)
  }

  const dateStr = now.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  const hasClockIn    = !!record?.clock_in
  const hasBreakStart = !!record?.break_start
  const hasBreakEnd   = !!record?.break_end
  const hasClockOut   = !!record?.clock_out
  const onBreak       = hasBreakStart && !hasBreakEnd

  // ボタン表示判定
  const showClockIn    = !hasClockIn
  const showBreakStart = hasClockIn && !hasBreakStart && !hasClockOut
  const showBreakEnd   = onBreak
  const showClockOut   = hasClockIn && !hasClockOut && !onBreak

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* 日時表示 */}
      <div className="text-center py-4">
        <p className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>{dateStr}</p>
        <p className="text-4xl font-black tabular-nums mt-1" style={{
          background: `linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78))`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>{timeStr}</p>
      </div>

      {/* メッセージ */}
      {message && (
        <div className="rounded-xl px-4 py-3 text-sm text-center"
          style={{ background: 'oklch(0.72 0.18 150 / 0.12)', border: '1px solid oklch(0.72 0.18 150 / 0.3)', color: 'oklch(0.72 0.18 150)' }}>
          {message}
        </div>
      )}

      {/* 打刻ボタン */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : hasClockOut ? (
        <div className="rounded-2xl p-6 text-center"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}20` }}>
          <p className="text-lg font-bold" style={{ color: 'oklch(0.88 0.008 75)' }}>本日の勤務終了</p>
          <p className="text-sm mt-1" style={{ color: 'oklch(0.55 0.007 75)' }}>お疲れ様でした！</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {showClockIn && (
            <PunchButton
              label="出勤"
              icon={<LogIn className="h-7 w-7" />}
              color="oklch(0.52 0.22 160)"
              loading={punching === 'clock_in'}
              onClick={() => punch('clock_in')}
              span2
            />
          )}
          {showBreakStart && (
            <PunchButton
              label="休憩開始"
              icon={<Coffee className="h-7 w-7" />}
              color="oklch(0.65 0.18 55)"
              loading={punching === 'break_start'}
              onClick={() => punch('break_start')}
            />
          )}
          {showBreakEnd && (
            <PunchButton
              label="休憩終了"
              icon={<PlayCircle className="h-7 w-7" />}
              color="oklch(0.55 0.18 250)"
              loading={punching === 'break_end'}
              onClick={() => punch('break_end')}
              span2
            />
          )}
          {showClockOut && (
            <PunchButton
              label="退勤"
              icon={<LogOut className="h-7 w-7" />}
              color="oklch(0.65 0.22 25)"
              loading={punching === 'clock_out'}
              onClick={() => punch('clock_out')}
            />
          )}
        </div>
      )}

      {/* 本日の打刻状況 */}
      {(record || !loading) && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: `${GOLD}` }}>本日の打刻</p>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <TimeRow label="出勤" value={fmt(record?.clock_in ?? null)} active={!!record?.clock_in} />
            <TimeRow label="休憩開始" value={fmt(record?.break_start ?? null)} active={!!record?.break_start} />
            <TimeRow label="休憩終了" value={fmt(record?.break_end ?? null)} active={!!record?.break_end} />
            <TimeRow label="退勤" value={fmt(record?.clock_out ?? null)} active={!!record?.clock_out} />
          </div>
          {record?.work_minutes ? (
            <div className="mt-2 pt-3 border-t flex justify-between items-center" style={{ borderColor: `${GOLD}18` }}>
              <div>
                <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>実働時間</p>
                <p className="text-lg font-bold" style={{ color: GOLD }}>{minsToHHMM(record.work_minutes)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>本日の報酬</p>
                <p className="text-lg font-bold" style={{ color: GOLD }}>¥{record.daily_pay.toLocaleString()}</p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* 月別勤怠リンク */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}>
        <p className="px-4 pt-4 pb-2 text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>月別勤怠</p>
        {[...Array(3)].map((_, i) => {
          const d = new Date()
          d.setMonth(d.getMonth() - i)
          const y = d.getFullYear()
          const m = d.getMonth() + 1
          return (
            <Link
              key={i}
              href={`/attendance/${y}/${m}`}
              className="flex items-center justify-between px-4 py-3 border-t transition-colors"
              style={{ borderColor: `${GOLD}12`, color: 'oklch(0.75 0.008 75)' }}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" style={{ color: `${GOLD}80` }} />
                <span className="text-sm">{y}年{m}月</span>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: `${GOLD}60` }} />
            </Link>
          )
        })}
        <Link
          href="/attendance/history"
          className="flex items-center justify-between px-4 py-3 border-t text-xs transition-colors"
          style={{ borderColor: `${GOLD}12`, color: 'oklch(0.50 0.007 75)' }}
        >
          すべての履歴を見る
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

function PunchButton({ label, icon, color, loading, onClick, span2 }: {
  label: string; icon: React.ReactNode; color: string
  loading: boolean; onClick: () => void; span2?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl py-6 transition-all active:scale-[0.97] disabled:opacity-60 ${span2 ? 'col-span-2' : ''}`}
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
    >
      {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : icon}
      <span className="text-sm font-bold">{label}</span>
    </button>
  )
}

function TimeRow({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: 'oklch(0.45 0.006 75)' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: active ? 'oklch(0.88 0.008 75)' : 'oklch(0.40 0.005 75)' }}>
        {value}
      </p>
    </div>
  )
}
