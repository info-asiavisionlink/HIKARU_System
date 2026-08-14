'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, Clock, Plus, X, Loader2 } from 'lucide-react'

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

interface AssignedProject {
  id: string
  name: string
  project_type: string
  location_name: string | null
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: '予定', confirmed: '確定', in_progress: '作業中', completed: '完了',
}

// ─── シフト登録フォーム（モーダル） ───────────────────────────────
interface ShiftFormProps {
  projects: AssignedProject[]
  editShift?: Shift | null
  onClose: () => void
  onSuccess: () => void
}

function ShiftForm({ projects, editShift, onClose, onSuccess }: ShiftFormProps) {
  const isEdit = !!editShift
  const [projectId,  setProjectId]  = React.useState(editShift?.projects?.id ?? '')
  const [shiftDate,  setShiftDate]  = React.useState(editShift?.shift_date  ?? formatDate(new Date()))
  const [startTime,  setStartTime]  = React.useState(editShift?.start_time?.slice(0,5) ?? '09:00')
  const [endTime,    setEndTime]    = React.useState(editShift?.end_time?.slice(0,5)   ?? '18:00')
  const [notes,      setNotes]      = React.useState(editShift?.notes ?? '')
  const [submitting, setSubmitting] = React.useState(false)
  const [error,      setError]      = React.useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!projectId) { setError('案件を選択してください'); return }
    if (startTime >= endTime) { setError('終了時刻は開始時刻より後にしてください'); return }

    setSubmitting(true)
    try {
      const url    = isEdit ? `/api/shifts/${editShift!.id}` : '/api/shifts'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, shift_date: shiftDate, start_time: startTime, end_time: endTime, notes: notes || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '登録に失敗しました')
        return
      }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCancel() {
    if (!editShift) return
    if (!confirm('このシフトを取消しますか？')) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/shifts/${editShift.id}`, { method: 'PATCH', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '取消に失敗しました'); return }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '14px',
    background: 'oklch(0.10 0.004 260 / 0.80)',
    border: `1px solid ${GOLD}25`,
    color: 'oklch(0.90 0.008 75)',
    outline: 'none',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'oklch(0.04 0.002 260 / 0.80)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-lg rounded-t-2xl p-5 pb-8 space-y-4"
        style={{ background: 'oklch(0.08 0.005 260)', border: `1px solid ${GOLD}20`, borderBottom: 'none' }}>

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>
            {isEdit ? 'シフト編集' : 'シフト登録'}
          </h2>
          <button onClick={onClose} style={{ color: 'oklch(0.50 0.007 75)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ background: 'oklch(0.30 0.18 27 / 0.25)', color: 'oklch(0.80 0.18 27)' }}>
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* 案件 */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>案件 *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle} required>
              <option value="">選択してください</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* 日付 */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>日付 *</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} style={inputStyle} required />
          </div>

          {/* 時間帯 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>開始時刻 *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>終了時刻 *</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-1">
            <label className="text-xs font-medium" style={{ color: 'oklch(0.55 0.007 75)' }}>備考</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="任意"
              style={{ ...inputStyle, resize: 'none' }} />
          </div>

          {/* ボタン */}
          <div className="flex gap-2 pt-1">
            {isEdit && editShift?.status === 'scheduled' && (
              <button type="button" onClick={handleCancel} disabled={submitting}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'oklch(0.18 0.05 27 / 0.60)', color: 'oklch(0.80 0.15 27)', border: `1px solid oklch(0.40 0.15 27 / 0.30)` }}>
                取消
              </button>
            )}
            <button type="submit" disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '更新' : '登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── メインページ ──────────────────────────────────────────────────
export default function SchedulePage() {
  const today    = new Date()
  const [baseDate, setBaseDate]       = React.useState(today)
  const [shifts,   setShifts]         = React.useState<Shift[]>([])
  const [loading,  setLoading]        = React.useState(true)
  const [error,    setError]          = React.useState<string | null>(null)
  const [showForm, setShowForm]       = React.useState(false)
  const [editShift, setEditShift]     = React.useState<Shift | null>(null)
  const [assignedProjects, setAssignedProjects] = React.useState<AssignedProject[]>([])

  // 担当案件を取得（シフト登録フォーム用）
  React.useEffect(() => {
    fetch('/api/jobs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(({ data }) => setAssignedProjects((data ?? []).map((p: any) => ({
        id: p.id, name: p.name, project_type: p.project_type, location_name: p.location_name,
      }))))
      .catch(() => {})
  }, [])

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
    setError(null)
    try {
      const res = await fetch(`/api/shifts?date_from=${dateFrom}&date_to=${dateTo}`, { credentials: 'include' })
      if (!res.ok) {
        setError('シフトを取得できませんでした')
        return
      }
      const { shifts: data } = await res.json()
      setShifts(data ?? [])
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  React.useEffect(() => { fetchShifts() }, [fetchShifts])

  const todayStr = formatDate(today)

  const shiftsByDate = React.useMemo(() => {
    const map: Record<string, Shift[]> = {}
    for (const s of shifts) {
      if (!map[s.shift_date]) map[s.shift_date] = []
      map[s.shift_date].push(s)
    }
    return map
  }, [shifts])

  const monthLabel = `${baseDate.getFullYear()}年${baseDate.getMonth()+1}月`

  function openNewForm() { setEditShift(null); setShowForm(true) }
  function openEditForm(shift: Shift) {
    if (shift.status !== 'scheduled') return
    setEditShift(shift); setShowForm(true)
  }
  function closeForm() { setShowForm(false); setEditShift(null) }
  function handleFormSuccess() { closeForm(); fetchShifts() }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>スケジュール</h1>
        {/* シフト登録ボタン */}
        <button onClick={openNewForm}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}>
          <Plus className="h-3.5 w-3.5" />
          シフト登録
        </button>
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
          const ds        = formatDate(d)
          const isToday   = ds === todayStr
          const dayShifts = shiftsByDate[ds] ?? []
          const hasBoth   = dayShifts.some(s => s.status === 'confirmed')

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
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-32 gap-2">
          <p className="text-sm text-center" style={{ color: 'oklch(0.65 0.18 27)' }}>{error}</p>
          <button onClick={fetchShifts} className="text-xs underline" style={{ color: GOLD }}>
            再読み込み
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {weekDates.map(d => {
            const ds        = formatDate(d)
            const dayShifts = shiftsByDate[ds] ?? []
            const isToday   = ds === todayStr
            const isPast    = d < today && !isToday

            return (
              <div key={ds}
                className="rounded-[var(--radius-xl)] overflow-hidden"
                style={{
                  border: isToday ? `1px solid ${GOLD}35` : '1px solid oklch(0.12 0.003 260)',
                  background: isToday ? `${GOLD}05` : 'oklch(0.07 0.003 260)',
                  opacity: isPast ? 0.65 : 1,
                }}>
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

                {dayShifts.length === 0 ? (
                  <p className="px-3 py-2 text-xs" style={{ color: 'oklch(0.32 0.005 75)' }}>—</p>
                ) : dayShifts.map(shift => {
                  const col         = typeColor(shift.projects?.project_type ?? '')
                  const isConfirmed = shift.status === 'confirmed'
                  const canEdit     = shift.status === 'scheduled'

                  return (
                    <div key={shift.id}
                      className={`px-3 py-3 space-y-1.5 ${canEdit ? 'cursor-pointer' : ''}`}
                      style={{ borderTop: '1px solid oklch(0.10 0.003 260)' }}
                      onClick={() => canEdit && openEditForm(shift)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" style={{ color: col }} />
                          <span className="text-xs font-bold tabular-nums" style={{ color: col }}>
                            {shift.start_time.slice(0,5)} 〜 {shift.end_time.slice(0,5)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {canEdit && (
                            <span className="text-[9px]" style={{ color: `${GOLD}60` }}>タップで編集</span>
                          )}
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              background: isConfirmed ? `${CYAN}18` : `${GOLD}15`,
                              color: isConfirmed ? CYAN : GOLD,
                            }}>
                            {STATUS_LABEL[shift.status] ?? shift.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm font-semibold" style={{ color: 'oklch(0.92 0.008 75)' }}>
                        {shift.projects?.name ?? '—'}
                      </p>

                      {shift.projects?.location_name && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.45 0.005 75)' }} />
                          <span className="text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
                            {shift.projects.location_name}
                          </span>
                        </div>
                      )}

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

      {/* シフト登録・編集フォーム（モーダル） */}
      {showForm && (
        <ShiftForm
          projects={assignedProjects}
          editShift={editShift}
          onClose={closeForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  )
}
