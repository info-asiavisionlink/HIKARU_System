'use client'

import * as React from 'react'
import { Plus, X, Loader2, CalendarCheck, MapPin, Clock, Pencil, Ban } from 'lucide-react'
import { getJSTDateString } from '@/lib/date'

const GOLD   = 'oklch(0.73 0.12 78)'
const CYAN   = 'oklch(0.85 0.18 198)'
const RED    = 'oklch(0.70 0.18 25)'

const STATUS_LABEL: Record<string, string> = {
  scheduled:   '予定',
  confirmed:   '確定',
  in_progress: '作業中',
  completed:   '完了',
  cancelled:   '取消済',
}

const STATUS_COLOR: Record<string, string> = {
  scheduled:   GOLD,
  confirmed:   CYAN,
  in_progress: 'oklch(0.75 0.18 150)',
  completed:   'oklch(0.60 0.008 75)',
  cancelled:   'oklch(0.40 0.005 75)',
}

interface Shift {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  status: string
  notes: string | null
  assignee_type: string
  projects: { id: string; name: string; location_name: string | null; project_type: string } | null
}

interface AssignedProject {
  id: string
  name: string
  location_name: string | null
}

// ─── フォームコンポーネント ────────────────────────────────────────
interface ShiftFormProps {
  projects: AssignedProject[]
  editShift?: Shift | null
  defaultDate?: string
  onClose: () => void
  onSuccess: () => void
}

function ShiftForm({ projects, editShift, defaultDate, onClose, onSuccess }: ShiftFormProps) {
  const isEdit   = !!editShift
  const [projectId,  setProjectId]  = React.useState(editShift?.projects?.id ?? '')
  const [shiftDate,  setShiftDate]  = React.useState(
    editShift?.shift_date ?? defaultDate ?? getJSTDateString()
  )
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
        body: JSON.stringify({
          project_id: projectId,
          shift_date: shiftDate,
          start_time: startTime,
          end_time:   endTime,
          notes:      notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '登録に失敗しました'); return }
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '10px', fontSize: '14px',
    background: 'oklch(0.10 0.004 260 / 0.80)',
    border: `1px solid ${GOLD}28`,
    color: 'oklch(0.90 0.008 75)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      style={{ background: 'oklch(0.04 0.002 260 / 0.85)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl md:rounded-2xl p-6 pb-8 space-y-5"
        style={{ background: 'oklch(0.08 0.005 260)', border: `1px solid ${GOLD}22` }}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold" style={{ color: 'oklch(0.90 0.008 75)' }}>
            {isEdit ? 'シフト編集' : '新規シフト登録'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'oklch(0.45 0.005 75)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="px-3 py-2.5 rounded-xl text-sm"
            style={{ background: 'oklch(0.28 0.15 25 / 0.30)', color: 'oklch(0.82 0.16 25)', border: '1px solid oklch(0.50 0.15 25 / 0.30)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 案件選択 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'oklch(0.55 0.007 75)' }}>案件 *</label>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} style={inputStyle} required>
              <option value="">— 担当案件から選択 —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.location_name ? `（${p.location_name}）` : ''}
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-xs" style={{ color: 'oklch(0.48 0.006 75)' }}>
                担当案件がありません。管理者にお問い合わせください。
              </p>
            )}
          </div>

          {/* 日付 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'oklch(0.55 0.007 75)' }}>日付 *</label>
            <input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} style={inputStyle} required />
          </div>

          {/* 時間帯 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'oklch(0.55 0.007 75)' }}>開始時刻 *</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inputStyle} required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold" style={{ color: 'oklch(0.55 0.007 75)' }}>終了時刻 *</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inputStyle} required />
            </div>
          </div>

          {/* 備考 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold" style={{ color: 'oklch(0.55 0.007 75)' }}>備考</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="任意入力"
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold"
              style={{ background: 'oklch(0.12 0.005 260)', color: 'oklch(0.55 0.007 75)', border: `1px solid ${GOLD}15` }}>
              キャンセル
            </button>
            <button type="submit" disabled={submitting || projects.length === 0}
              className="flex-[2] py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity disabled:opacity-50"
              style={{ background: GOLD, color: 'oklch(0.06 0.003 260)' }}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? '更新する' : 'シフトを登録'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── シフトカード ─────────────────────────────────────────────────
interface ShiftCardProps {
  shift: Shift
  onEdit: (s: Shift) => void
  onCancel: (s: Shift) => void
}

function ShiftCard({ shift, onEdit, onCancel }: ShiftCardProps) {
  const canEdit   = shift.status === 'scheduled'
  const statusCol = STATUS_COLOR[shift.status] ?? GOLD
  const typeColor = shift.projects?.project_type === 'recurring' ? CYAN
                  : shift.projects?.project_type === 'hotel'     ? 'oklch(0.75 0.15 290)'
                  : GOLD

  return (
    <div
      className="rounded-2xl p-4 space-y-3"
      style={{
        background: 'oklch(0.08 0.005 260)',
        border: `1px solid ${canEdit ? GOLD + '22' : 'oklch(0.12 0.003 260)'}`,
      }}
    >
      {/* 上段: 日付 + ステータス */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold" style={{ color: 'oklch(0.88 0.008 75)' }}>
            {shift.shift_date}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock className="h-3 w-3" style={{ color: typeColor }} />
            <span className="text-sm font-semibold tabular-nums" style={{ color: typeColor }}>
              {shift.start_time.slice(0,5)} 〜 {shift.end_time.slice(0,5)}
            </span>
          </div>
        </div>
        <span
          className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${statusCol}18`, color: statusCol, border: `1px solid ${statusCol}30` }}
        >
          {STATUS_LABEL[shift.status] ?? shift.status}
        </span>
      </div>

      {/* 案件名 */}
      <div>
        <p className="text-sm font-semibold" style={{ color: 'oklch(0.90 0.008 75)' }}>
          {shift.projects?.name ?? '案件未設定'}
        </p>
        {shift.projects?.location_name && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="h-3 w-3 shrink-0" style={{ color: 'oklch(0.45 0.005 75)' }} />
            <span className="text-xs" style={{ color: 'oklch(0.52 0.007 75)' }}>
              {shift.projects.location_name}
            </span>
          </div>
        )}
      </div>

      {/* 備考 */}
      {shift.notes && (
        <p className="text-xs px-3 py-2 rounded-lg"
          style={{ background: 'oklch(0.06 0.003 260)', color: 'oklch(0.55 0.007 75)' }}>
          {shift.notes}
        </p>
      )}

      {/* アクション（scheduledのみ） */}
      {canEdit && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onEdit(shift)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: `${GOLD}14`, color: GOLD, border: `1px solid ${GOLD}28` }}
          >
            <Pencil className="h-3.5 w-3.5" /> 編集
          </button>
          <button
            onClick={() => onCancel(shift)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: 'oklch(0.28 0.12 25 / 0.18)', color: RED, border: '1px solid oklch(0.50 0.12 25 / 0.25)' }}
          >
            <Ban className="h-3.5 w-3.5" /> 取消
          </button>
        </div>
      )}
    </div>
  )
}

// ─── メインページ ─────────────────────────────────────────────────
export default function ShiftsPage() {
  const [shifts,    setShifts]    = React.useState<Shift[]>([])
  const [projects,  setProjects]  = React.useState<AssignedProject[]>([])
  const [loading,   setLoading]   = React.useState(true)
  const [showForm,  setShowForm]  = React.useState(false)
  const [editShift, setEditShift] = React.useState<Shift | null>(null)
  const [cancelling, setCancelling] = React.useState<string | null>(null)

  // 直近3ヶ月のシフトを取得
  async function fetchShifts() {
    setLoading(true)
    try {
      const now   = new Date()
      const from  = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to    = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      const fmt   = (d: Date) => getJSTDateString(d)
      const res   = await fetch(`/api/shifts?date_from=${fmt(from)}&date_to=${fmt(to)}`, { credentials: 'include' })
      if (res.ok) {
        const { shifts: data } = await res.json()
        setShifts(data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  // 担当案件を取得
  async function fetchProjects() {
    try {
      const res = await fetch('/api/jobs', { credentials: 'include' })
      if (res.ok) {
        const { data } = await res.json()
        setProjects((data ?? []).map((p: any) => ({
          id: p.id, name: p.name, location_name: p.location_name,
        })))
      }
    } catch {}
  }

  React.useEffect(() => {
    fetchShifts()
    fetchProjects()
  }, [])

  async function handleCancel(shift: Shift) {
    if (!confirm(`「${shift.shift_date} ${shift.start_time.slice(0,5)}〜${shift.end_time.slice(0,5)}」のシフトを取消しますか？`)) return
    setCancelling(shift.id)
    try {
      const res  = await fetch(`/api/shifts/${shift.id}`, { method: 'PATCH', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? '取消に失敗しました'); return }
      await fetchShifts()
    } finally {
      setCancelling(null)
    }
  }

  function openEdit(shift: Shift) { setEditShift(shift); setShowForm(true) }
  function openNew()              { setEditShift(null); setShowForm(true) }
  function closeForm()            { setShowForm(false); setEditShift(null) }
  async function handleSuccess()  { closeForm(); await fetchShifts() }

  // 今月以降のシフト / 過去のシフト に分類
  const todayStr   = getJSTDateString()
  const upcoming   = shifts.filter(s => s.shift_date >= todayStr && s.status !== 'cancelled')
  const past       = shifts.filter(s => s.shift_date < todayStr  && s.status !== 'cancelled')
  const cancelled  = shifts.filter(s => s.status === 'cancelled')

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"
            style={{ color: 'oklch(0.92 0.008 75)' }}>
            <CalendarCheck className="h-5 w-5" style={{ color: GOLD }} />
            シフト管理
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.48 0.006 75)' }}>
            自分のシフトを登録・確認できます
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all active:scale-95"
          style={{ background: GOLD, color: 'oklch(0.06 0.003 260)', boxShadow: `0 4px 14px ${GOLD}40` }}
        >
          <Plus className="h-4 w-4" />
          シフト登録
        </button>
      </div>

      {/* 読み込み中 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
          <p className="text-sm" style={{ color: 'oklch(0.45 0.005 75)' }}>読み込み中...</p>
        </div>
      ) : (
        <>
          {/* 今後のシフト */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="h-1 w-4 rounded-full" style={{ background: GOLD }} />
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>
                今後のシフト ({upcoming.length})
              </h2>
            </div>
            {upcoming.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-10 rounded-2xl gap-3"
                style={{ border: `1px dashed ${GOLD}22`, background: `${GOLD}04` }}
              >
                <CalendarCheck className="h-10 w-10 opacity-20" style={{ color: GOLD }} />
                <p className="text-sm" style={{ color: 'oklch(0.40 0.005 75)' }}>シフトがありません</p>
                <button
                  onClick={openNew}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}30` }}
                >
                  <Plus className="h-3.5 w-3.5" /> シフトを登録する
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcoming.map(s => (
                  <div key={s.id} style={{ opacity: cancelling === s.id ? 0.5 : 1 }}>
                    <ShiftCard shift={s} onEdit={openEdit} onCancel={handleCancel} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 過去のシフト */}
          {past.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-1 w-4 rounded-full" style={{ background: 'oklch(0.35 0.005 75)' }} />
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'oklch(0.38 0.005 75)' }}>
                  過去のシフト ({past.length})
                </h2>
              </div>
              <div className="space-y-3" style={{ opacity: 0.60 }}>
                {past.map(s => (
                  <ShiftCard key={s.id} shift={s} onEdit={() => {}} onCancel={() => {}} />
                ))}
              </div>
            </section>
          )}

          {/* 取消済み */}
          {cancelled.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-1 w-4 rounded-full" style={{ background: 'oklch(0.28 0.005 75)' }} />
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'oklch(0.32 0.005 75)' }}>
                  取消済み ({cancelled.length})
                </h2>
              </div>
              <div className="space-y-2" style={{ opacity: 0.45 }}>
                {cancelled.slice(0, 5).map(s => (
                  <div key={s.id}
                    className="px-4 py-3 rounded-xl flex items-center gap-3"
                    style={{ border: '1px solid oklch(0.12 0.003 260)', background: 'oklch(0.06 0.003 260)' }}>
                    <Ban className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.35 0.005 75)' }} />
                    <span className="text-sm" style={{ color: 'oklch(0.42 0.005 75)' }}>
                      {s.shift_date} {s.start_time.slice(0,5)}〜{s.end_time.slice(0,5)}
                      {s.projects?.name ? ` — ${s.projects.name}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* 登録・編集フォーム */}
      {showForm && (
        <ShiftForm
          projects={projects}
          editShift={editShift}
          onClose={closeForm}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
