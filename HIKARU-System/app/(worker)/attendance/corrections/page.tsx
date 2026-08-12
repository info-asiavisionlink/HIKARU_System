'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronLeft, FilePen, Loader2, Clock } from 'lucide-react'

const GOLD = 'oklch(0.73 0.12 78)'

type Correction = {
  id: string
  attendance_record_id: string
  original_clock_in:    string | null
  original_clock_out:   string | null
  original_break_start: string | null
  original_break_end:   string | null
  requested_clock_in:    string | null
  requested_clock_out:   string | null
  requested_break_start: string | null
  requested_break_end:   string | null
  reason:       string
  status:       'submitted' | 'approved' | 'rejected' | 'withdrawn'
  review_comment: string | null
  reviewed_at:    string | null
  created_at:     string
  attendance_records: {
    id:           string
    work_date:    string
    clock_in:     string | null
    clock_out:    string | null
    break_start:  string | null
    break_end:    string | null
    work_minutes: number | null
    daily_pay:    number | null
  } | null
}

const STATUS_LABEL: Record<Correction['status'], string> = {
  submitted: '申請中',
  approved:  '承認済み',
  rejected:  '却下',
  withdrawn: '取り下げ',
}

const STATUS_COLOR: Record<Correction['status'], string> = {
  submitted: 'oklch(0.65 0.18 250)',
  approved:  'oklch(0.70 0.18 150)',
  rejected:  'oklch(0.65 0.20 25)',
  withdrawn: 'oklch(0.50 0.005 75)',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(date: string) {
  return new Date(date).toLocaleDateString('ja-JP', {
    month: 'numeric', day: 'numeric', weekday: 'short',
  })
}

function fmtDatetime(iso: string) {
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function CorrectionsListPage() {
  const [corrections, setCorrections] = React.useState<Correction[]>([])
  const [loading, setLoading]         = React.useState(true)
  const [withdrawing, setWithdrawing] = React.useState<string | null>(null)
  const [message, setMessage]         = React.useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  React.useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    const res  = await fetch('/api/attendance/corrections', { credentials: 'include' })
    const json = await res.json()
    setCorrections(json.corrections ?? [])
    setLoading(false)
  }

  async function handleWithdraw(id: string) {
    if (!confirm('この修正申請を取り下げますか？')) return
    setWithdrawing(id)
    setMessage(null)
    const res = await fetch(`/api/attendance/corrections/${id}/withdraw`, {
      method: 'PATCH',
      credentials: 'include',
    })
    if (res.ok) {
      setMessage({ type: 'ok', text: '取り下げました' })
      await fetchList()
    } else {
      const json = await res.json()
      setMessage({ type: 'err', text: json.error ?? '取り下げに失敗しました' })
    }
    setWithdrawing(null)
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <Link href="/attendance" className="p-1.5 rounded-lg" style={{ color: `${GOLD}80` }}>
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>
            修正申請一覧
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'oklch(0.50 0.007 75)' }}>
            自分の勤怠修正申請
          </p>
        </div>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className="rounded-xl px-4 py-3 text-sm text-center"
          style={{
            background: message.type === 'ok'
              ? 'oklch(0.70 0.18 150 / 0.12)'
              : 'oklch(0.65 0.20 25 / 0.12)',
            border: `1px solid ${message.type === 'ok'
              ? 'oklch(0.70 0.18 150 / 0.35)'
              : 'oklch(0.65 0.20 25 / 0.35)'}`,
            color: message.type === 'ok' ? 'oklch(0.70 0.18 150)' : 'oklch(0.65 0.20 25)',
          }}
        >
          {message.text}
        </div>
      )}

      {/* リスト */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: GOLD }} />
        </div>
      ) : corrections.length === 0 ? (
        <div
          className="rounded-2xl py-12 text-center"
          style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}
        >
          <FilePen className="h-8 w-8 mx-auto mb-3" style={{ color: `${GOLD}40` }} />
          <p className="text-sm" style={{ color: 'oklch(0.45 0.006 75)' }}>修正申請はありません</p>
          <Link
            href="/attendance"
            className="inline-block mt-4 text-xs px-4 py-2 rounded-lg"
            style={{ background: `${GOLD}18`, color: GOLD, border: `1px solid ${GOLD}30` }}
          >
            勤怠記録から申請する
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {corrections.map((c) => {
            const workDate = c.attendance_records?.work_date
            const status   = c.status
            const color    = STATUS_COLOR[status]
            const isSubmitted = status === 'submitted'

            return (
              <div
                key={c.id}
                className="rounded-2xl overflow-hidden"
                style={{ background: 'oklch(0.09 0.005 255 / 0.85)', border: `1px solid ${GOLD}18` }}
              >
                {/* ヘッダー行 */}
                <div
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: `1px solid ${GOLD}12` }}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" style={{ color: `${GOLD}80` }} />
                    <span className="text-sm font-semibold" style={{ color: 'oklch(0.88 0.008 75)' }}>
                      {workDate ? fmtDate(workDate) : '日付不明'}
                    </span>
                  </div>
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: `${color}18`, color, border: `1px solid ${color}35` }}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>

                {/* 内容 */}
                <div className="px-4 py-3 space-y-3">
                  {/* 変更内容 */}
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['出勤', c.original_clock_in, c.requested_clock_in],
                      ['休憩開始', c.original_break_start, c.requested_break_start],
                      ['休憩終了', c.original_break_end, c.requested_break_end],
                      ['退勤', c.original_clock_out, c.requested_clock_out],
                    ] as [string, string | null, string | null][]).map(([label, orig, req]) => {
                      if (!req) return null
                      return (
                        <div key={label} className="text-xs">
                          <p style={{ color: 'oklch(0.40 0.005 75)' }}>{label}</p>
                          <p style={{ color: 'oklch(0.60 0.007 75)' }}>
                            <span style={{ textDecoration: 'line-through' }}>{fmt(orig)}</span>
                            {' → '}
                            <span style={{ color: GOLD, fontWeight: 600 }}>{fmt(req)}</span>
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* 理由 */}
                  <div>
                    <p className="text-[10px] mb-0.5" style={{ color: 'oklch(0.40 0.005 75)' }}>申請理由</p>
                    <p className="text-xs" style={{ color: 'oklch(0.72 0.007 75)' }}>{c.reason}</p>
                  </div>

                  {/* 却下理由（rejected時） */}
                  {status === 'rejected' && c.review_comment && (
                    <div
                      className="rounded-lg px-3 py-2"
                      style={{ background: 'oklch(0.65 0.20 25 / 0.08)', border: '1px solid oklch(0.65 0.20 25 / 0.25)' }}
                    >
                      <p className="text-[10px] mb-0.5" style={{ color: 'oklch(0.65 0.20 25 / 0.80)' }}>却下理由</p>
                      <p className="text-xs" style={{ color: 'oklch(0.65 0.20 25)' }}>{c.review_comment}</p>
                    </div>
                  )}

                  {/* フッター */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px]" style={{ color: 'oklch(0.38 0.005 75)' }}>
                      申請日: {fmtDatetime(c.created_at)}
                    </p>
                    {isSubmitted && (
                      <button
                        onClick={() => handleWithdraw(c.id)}
                        disabled={withdrawing === c.id}
                        className="text-xs px-3 py-1.5 rounded-lg transition-opacity disabled:opacity-50"
                        style={{
                          background: 'oklch(0.65 0.20 25 / 0.12)',
                          border: '1px solid oklch(0.65 0.20 25 / 0.35)',
                          color: 'oklch(0.65 0.20 25)',
                        }}
                      >
                        {withdrawing === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin inline" />
                        ) : (
                          '取り下げ'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
