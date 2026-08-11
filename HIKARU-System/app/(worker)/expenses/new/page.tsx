'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Upload, X, ChevronLeft, Check, Loader2, Receipt } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

const CATEGORIES = [
  { value: 'transport',   label: '交通費',   emoji: '🚃' },
  { value: 'parking',     label: '駐車場代', emoji: '🅿️' },
  { value: 'supplies',    label: '備品',     emoji: '📦' },
  { value: 'consumables', label: '消耗品',   emoji: '🧹' },
  { value: 'other',       label: 'その他',   emoji: '📋' },
]

export default function NewExpensePage() {
  const router  = useRouter()
  const fileRef = React.useRef<HTMLInputElement>(null)
  const cameraRef = React.useRef<HTMLInputElement>(null)

  const [saving,    setSaving]    = React.useState(false)
  const [uploading, setUploading] = React.useState(false)
  const [preview,   setPreview]   = React.useState<string | null>(null)
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null)
  const [myShifts,  setMyShifts]  = React.useState<any[]>([])
  const [myProjects, setMyProjects] = React.useState<any[]>([])

  const [form, setForm] = React.useState({
    expense_date: new Date().toISOString().split('T')[0],
    category:     'transport',
    amount:       '',
    description:  '',
    note:         '',
    project_id:   '',
    shift_id:     '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  // 今日・近日のシフト取得（シフト選択用）
  React.useEffect(() => {
    const today = new Date()
    const from  = new Date(today); from.setDate(from.getDate() - 7)
    const to    = new Date(today); to.setDate(to.getDate() + 7)
    const fmt   = (d: Date) => d.toISOString().split('T')[0]

    fetch(`/api/shifts?date_from=${fmt(from)}&date_to=${fmt(to)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : { shifts: [] })
      .then(d => setMyShifts(d.shifts ?? []))

    fetch('/api/jobs', { credentials: 'include' })
      .then(r => r.ok ? r.json() : { data: [] })
      .then(d => setMyProjects(d.data ?? []))
  }, [])

  function handleFileSelect(file: File) {
    setReceiptFile(file)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) {
      alert('金額を入力してください'); return
    }
    setSaving(true)

    // 1. 経費レコード作成（draft）
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...form,
        amount:     Number(form.amount),
        project_id: form.project_id || null,
        shift_id:   form.shift_id   || null,
      }),
    })

    if (!res.ok) {
      const j = await res.json()
      alert(j.error ?? '登録に失敗しました')
      setSaving(false)
      return
    }

    const { expense } = await res.json()

    // 2. 領収書アップロード（あれば）
    if (receiptFile) {
      setUploading(true)
      const formData = new FormData()
      formData.append('file', receiptFile)
      formData.append('expense_id', expense.id)
      await fetch('/api/upload-receipt', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      setUploading(false)
    }

    router.push('/expenses')
  }

  return (
    <div className="px-4 py-4 pb-24 space-y-5 min-h-dvh">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-full"
          style={{ background: `${GOLD}10`, color: GOLD }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>経費を追加</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 領収書撮影（最優先） */}
        <div className="rounded-[var(--radius-xl)] overflow-hidden"
          style={{ border: `1px solid ${GOLD}30`, background: 'oklch(0.09 0.005 255 / 0.8)' }}>
          <div className="p-3 pb-0">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>
              領収書
            </p>
          </div>

          {preview ? (
            <div className="relative m-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="領収書" className="w-full rounded-[var(--radius-lg)] max-h-48 object-contain"
                style={{ background: 'oklch(0.05 0.002 260)' }} />
              <button type="button"
                onClick={() => { setPreview(null); setReceiptFile(null) }}
                className="absolute top-2 right-2 p-1.5 rounded-full"
                style={{ background: 'oklch(0 0 0 / 0.6)', color: 'white' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2 p-3">
              {/* カメラ撮影（優先） */}
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
              <button type="button"
                onClick={() => cameraRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-[var(--radius-xl)] transition-all active:scale-[0.97]"
                style={{ background: `${GOLD}18`, border: `1.5px solid ${GOLD}40` }}>
                <Camera className="h-8 w-8" style={{ color: GOLD, filter: `drop-shadow(0 0 6px ${GOLD}80)` }} />
                <span className="text-xs font-bold" style={{ color: GOLD }}>カメラで撮影</span>
              </button>

              {/* ファイル選択 */}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }} />
              <button type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 flex flex-col items-center gap-2 py-5 rounded-[var(--radius-xl)] transition-all active:scale-[0.97]"
                style={{ background: 'oklch(0.12 0.003 260)', border: '1.5px solid oklch(0.20 0.003 260)' }}>
                <Upload className="h-8 w-8" style={{ color: 'oklch(0.55 0.007 75)' }} />
                <span className="text-xs font-bold" style={{ color: 'oklch(0.55 0.007 75)' }}>ファイル選択</span>
              </button>
            </div>
          )}
        </div>

        {/* カテゴリー */}
        <div className="rounded-[var(--radius-xl)] p-4"
          style={{ background: 'oklch(0.09 0.005 255 / 0.8)', border: '1px solid oklch(0.15 0.003 260)' }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: `${GOLD}80` }}>カテゴリー</p>
          <div className="grid grid-cols-5 gap-1.5">
            {CATEGORIES.map(cat => (
              <button key={cat.value} type="button"
                onClick={() => upd('category', cat.value)}
                className="flex flex-col items-center gap-1 py-2.5 rounded-[var(--radius-lg)] transition-all active:scale-[0.95]"
                style={form.category === cat.value
                  ? { background: `${GOLD}22`, border: `1px solid ${GOLD}60` }
                  : { background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.18 0.003 260)' }}>
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-[9px] font-medium text-center leading-tight"
                  style={{ color: form.category === cat.value ? GOLD : 'oklch(0.55 0.007 75)' }}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* 金額・日付 */}
        <div className="rounded-[var(--radius-xl)] p-4 space-y-3"
          style={{ background: 'oklch(0.09 0.005 255 / 0.8)', border: '1px solid oklch(0.15 0.003 260)' }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-2" style={{ color: `${GOLD}80` }}>
              金額 *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black"
                style={{ color: GOLD }}>¥</span>
              <input
                type="number" inputMode="numeric" min="1"
                value={form.amount}
                onChange={e => upd('amount', e.target.value)}
                placeholder="0"
                className="w-full pl-8 pr-4 py-3 rounded-[var(--radius-lg)] text-xl font-black text-right outline-none"
                style={{
                  background: `${GOLD}08`, border: `1px solid ${GOLD}30`,
                  color: 'oklch(0.92 0.008 75)',
                }}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest block mb-1.5" style={{ color: `${GOLD}80` }}>
              経費発生日 *
            </label>
            <input type="date" value={form.expense_date} onChange={e => upd('expense_date', e.target.value)}
              className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none"
              style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.90 0.008 75)' }}
              required />
          </div>
        </div>

        {/* 内容 */}
        <div className="rounded-[var(--radius-xl)] p-4 space-y-3"
          style={{ background: 'oklch(0.09 0.005 255 / 0.8)', border: '1px solid oklch(0.15 0.003 260)' }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>内容</p>
          <input type="text" value={form.description} onChange={e => upd('description', e.target.value)}
            placeholder="例: 現場往復の電車代"
            className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none"
            style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.90 0.008 75)' }} />

          {/* シフト選択 */}
          {myShifts.length > 0 && (
            <div>
              <label className="text-[11px] block mb-1" style={{ color: 'oklch(0.55 0.007 75)' }}>関連シフト（任意）</label>
              <select value={form.shift_id} onChange={e => upd('shift_id', e.target.value)}
                className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none appearance-none"
                style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.90 0.008 75)' }}>
                <option value="">選択しない</option>
                {myShifts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.shift_date} {s.start_time?.slice(0,5)} {s.projects?.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 案件選択 */}
          {myProjects.length > 0 && (
            <div>
              <label className="text-[11px] block mb-1" style={{ color: 'oklch(0.55 0.007 75)' }}>関連案件（任意）</label>
              <select value={form.project_id} onChange={e => upd('project_id', e.target.value)}
                className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none appearance-none"
                style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.90 0.008 75)' }}>
                <option value="">選択しない</option>
                {myProjects.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <textarea value={form.note} onChange={e => upd('note', e.target.value)}
            rows={2} placeholder="備考（任意）"
            className="w-full px-3 py-2.5 rounded-[var(--radius-lg)] text-sm outline-none resize-none"
            style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.90 0.008 75)' }} />
        </div>

        {/* 送信ボタン */}
        <button type="submit" disabled={saving || uploading}
          className="w-full py-4 rounded-[var(--radius-xl)] text-base font-black transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: saving ? 'oklch(0.25 0.008 75)' : `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`,
            color: 'oklch(0.06 0.003 260)',
            boxShadow: saving ? 'none' : `0 0 20px ${GOLD}40`,
          }}>
          {saving || uploading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              {uploading ? '領収書アップロード中...' : '保存中...'}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Receipt className="h-5 w-5" />
              下書き保存
            </span>
          )}
        </button>

        <p className="text-center text-xs" style={{ color: 'oklch(0.45 0.005 75)' }}>
          保存後に「申請する」ボタンで管理者へ送信します
        </p>
      </form>
    </div>
  )
}
