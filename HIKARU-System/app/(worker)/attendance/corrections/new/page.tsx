'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Loader2 } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function toInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromInputValue(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

type FieldKey = 'clock_in' | 'clock_out' | 'break_start' | 'break_end'

const FIELD_LABELS: Record<FieldKey, string> = {
  clock_in:    '出勤',
  break_start: '休憩開始',
  break_end:   '休憩終了',
  clock_out:   '退勤',
}

// useSearchParams を使う内部コンポーネント（Suspense でラップされる）
function CorrectionForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const recordId = searchParams.get('record_id') ?? ''
  const workDate = searchParams.get('date')      ?? ''
  const origCi   = searchParams.get('clock_in')
  const origCo   = searchParams.get('clock_out')
  const origBs   = searchParams.get('break_start')
  const origBe   = searchParams.get('break_end')

  const [requested, setRequested] = React.useState<Record<FieldKey, string>>({
    clock_in:    '',
    clock_out:   '',
    break_start: '',
    break_end:   '',
  })
  const [reason,     setReason]     = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error,      setError]      = React.useState<string | null>(null)

  if (!recordId) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center">
        <p className="text-sm" style={{ color: 'oklch(0.50 0.007 75)' }}>
          勤怠記録が指定されていません
        </p>
        <Link href="/attendance" className="inline-block mt-4 text-sm" style={{ color: GOLD }}>
          ← 勤怠管理に戻る
        </Link>
      </div>
    )
  }

  const dateLabel = workDate
    ? new Date(workDate + 'T00:00:00').toLocaleDateString('ja-JP', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      })
    : '日付不明'

  const origValues: Record<FieldKey, string | null> = {
    clock_in:    origCi,
    clock_out:   origCo,
    break_start: origBs,
    break_end:   origBe,
  }

  function handleChange(key: FieldKey, val: string) {
    setRequested(prev => ({ ...prev, [key]: val }))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const hasAny = (Object.keys(requested) as FieldKey[]).some(k => requested[k] !== '')
    if (!hasAny) {
      setError('修正内容を1つ以上入力してください')
      setSubmitting(false)
      return
    }

    const body = {
      attendance_record_id:  recordId,
      requested_clock_in:    fromInputValue(requested.clock_in),
      requested_clock_out:   fromInputValue(requested.clock_out),
      requested_break_start: fromInputValue(requested.break_start),
      requested_break_end:   fromInputValue(requested.break_end),
      reason: reason.trim(),
    }

    const res  = await fetch('/api/attendance/corrections', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      credentials: 'include',
    })
    const json = await res.json()

    if (res.ok) {
      router.push('/attendance/corrections')
    } else {
      setError(json.error ?? '申請に失敗しました')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg"
          style={{ color: `${GOLD}80` }}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
            勤怠修正申請
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>{dateLabel}</p>
        </div>
      </div>

      {/* 現在の打刻 */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}
      >
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: GOLD }}>
          現在の打刻
        </p>
        <div className="grid grid-cols-4 gap-2 text-xs">
          {(Object.keys(FIELD_LABELS) as FieldKey[]).map(key => (
            <div key={key}>
              <p style={{ color: 'oklch(0.40 0.005 75)' }}>{FIELD_LABELS[key]}</p>
              <p className="font-semibold mt-0.5" style={{ color: 'oklch(0.80 0.008 75)' }}>
                {fmt(origValues[key])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            background: 'oklch(0.65 0.20 25 / 0.10)',
            border: '1px solid oklch(0.65 0.20 25 / 0.30)',
            color: 'oklch(0.65 0.20 25)',
          }}
        >
          {error}
        </div>
      )}

      {/* 申請フォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div
          className="rounded-2xl p-4 space-y-4"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}
        >
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: GOLD }}>
            修正希望（変更する項目のみ入力）
          </p>

          {(Object.keys(FIELD_LABELS) as FieldKey[]).map(key => (
            <div key={key}>
              <label className="block text-xs mb-1" style={{ color: 'oklch(0.55 0.007 75)' }}>
                {FIELD_LABELS[key]}
                {origValues[key] && (
                  <span className="ml-2" style={{ color: 'oklch(0.42 0.005 75)' }}>
                    現在: {fmt(origValues[key])}
                  </span>
                )}
              </label>
              <input
                type="datetime-local"
                value={requested[key]}
                onChange={e => handleChange(key, e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all"
                style={{
                  background: 'oklch(0.06 0.003 260)',
                  border: `1px solid ${requested[key] ? GOLD + '60' : GOLD + '20'}`,
                  color: requested[key] ? 'oklch(0.88 0.008 75)' : 'oklch(0.40 0.005 75)',
                }}
              />
              {requested[key] && origValues[key] && (
                <p className="mt-0.5 text-[10px]" style={{ color: 'oklch(0.45 0.006 75)' }}>
                  {fmt(origValues[key])} →{' '}
                  <span style={{ color: GOLD }}>{fmt(fromInputValue(requested[key]))}</span>
                </p>
              )}
            </div>
          ))}
        </div>

        {/* 申請理由 */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}
        >
          <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: GOLD }}>
            申請理由 <span style={{ color: 'oklch(0.65 0.20 25)' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={e => { setReason(e.target.value); setError(null) }}
            placeholder="修正が必要な理由を記入してください"
            rows={3}
            maxLength={500}
            required
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none transition-all"
            style={{
              background: 'oklch(0.06 0.003 260)',
              border: `1px solid ${reason.trim() ? GOLD + '60' : GOLD + '20'}`,
              color: 'oklch(0.88 0.008 75)',
            }}
          />
          <p className="mt-1 text-[10px] text-right" style={{ color: 'oklch(0.40 0.005 75)' }}>
            {reason.length} / 500
          </p>
        </div>

        <p className="text-[11px] text-center" style={{ color: 'oklch(0.40 0.005 75)' }}>
          申請後は管理者が確認します。承認されるまで勤怠記録は変更されません。
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: `linear-gradient(135deg, oklch(0.52 0.10 75), oklch(0.73 0.12 78))`,
            color: 'oklch(0.06 0.003 260)',
            boxShadow: `0 4px 20px ${GOLD}40`,
          }}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin inline mr-2" />}
          {submitting ? '申請中...' : '修正申請を送信'}
        </button>
      </form>
    </div>
  )
}

// Suspense でラップしてエクスポート（useSearchParams 要件）
export default function CorrectionNewPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex justify-center items-center min-h-[50vh]">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      }
    >
      <CorrectionForm />
    </React.Suspense>
  )
}
