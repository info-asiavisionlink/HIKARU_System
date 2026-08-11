'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ChevronLeft, CheckCircle2, XCircle, Banknote, Clock, Undo2, Trash2, Receipt, Send } from 'lucide-react'

const GOLD   = 'oklch(0.73 0.12 78)'
const GREEN  = 'oklch(0.72 0.18 150)'
const RED    = 'oklch(0.65 0.22 25)'
const CYAN   = 'oklch(0.85 0.18 198)'
const YELLOW = 'oklch(0.80 0.18 85)'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
}
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: '下書き',   color: 'oklch(0.50 0.007 75)' },
  submitted: { label: '申請中',   color: YELLOW },
  approved:  { label: '承認済み', color: GREEN },
  rejected:  { label: '却下',     color: RED },
  settled:   { label: '精算済み', color: CYAN },
  withdrawn: { label: '取り下げ', color: 'oklch(0.45 0.005 75)' },
}

export default function ExpenseDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string
  const [expense, setExpense]   = React.useState<any>(null)
  const [loading, setLoading]   = React.useState(true)
  const [acting,  setActing]    = React.useState(false)
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/expenses/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExpense(d.expense) })
      .finally(() => setLoading(false))
  }, [id])

  // 領収書プレビュー URL 取得（signed URL）
  React.useEffect(() => {
    if (!expense?.expense_receipts?.length) return
    const receipt = expense.expense_receipts[0]
    fetch(`/api/receipt-url?path=${encodeURIComponent(receipt.storage_path)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setReceiptUrl(d.url) })
  }, [expense])

  async function submit() {
    if (!confirm('この経費を申請しますか？\n申請後は管理者の確認が入るまで編集できません。')) return
    setActing(true)
    const res = await fetch(`/api/expenses/${id}/submit`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      const { expense: updated } = await res.json()
      setExpense(updated)
    } else {
      const j = await res.json()
      alert(j.error ?? '申請に失敗しました')
    }
    setActing(false)
  }

  async function withdraw() {
    if (!confirm('申請を取り下げますか？下書きに戻ります。')) return
    setActing(true)
    const res = await fetch(`/api/expenses/${id}/withdraw`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      const { expense: updated } = await res.json()
      setExpense(updated)
    } else {
      const j = await res.json()
      alert(j.error ?? '取り下げに失敗しました')
    }
    setActing(false)
  }

  async function deleteExpense() {
    if (!confirm('この経費を削除しますか？')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) router.push('/expenses')
    else alert('削除に失敗しました')
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
    </div>
  )

  if (!expense) return (
    <div className="px-4 py-8 text-center" style={{ color: 'oklch(0.50 0.007 75)' }}>
      <p>経費が見つかりません</p>
    </div>
  )

  const st = STATUS_CONFIG[expense.status] ?? STATUS_CONFIG.draft

  return (
    <div className="px-4 py-4 pb-24 space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-full"
          style={{ background: `${GOLD}10`, color: GOLD }}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'oklch(0.92 0.008 75)' }}>経費詳細</h1>
        <span className="ml-auto text-[11px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30` }}>
          {st.label}
        </span>
      </div>

      {/* メイン情報 */}
      <div className="rounded-[var(--radius-xl)] p-5"
        style={{ background: 'oklch(0.09 0.005 255 / 0.82)', border: `1px solid ${GOLD}22` }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm" style={{ color: 'oklch(0.60 0.007 75)' }}>
              {CATEGORY_LABELS[expense.category] ?? expense.category}
            </p>
            <p className="text-3xl font-black mt-1"
              style={{
                background: `linear-gradient(135deg, oklch(0.62 0.11 75), ${GOLD})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
              ¥{expense.amount?.toLocaleString()}
            </p>
          </div>
          <Receipt className="h-8 w-8 opacity-30" style={{ color: GOLD }} />
        </div>

        <div className="space-y-2 text-sm">
          <Row label="発生日"   value={expense.expense_date} />
          {expense.description && <Row label="内容" value={expense.description} />}
          {expense.note        && <Row label="備考" value={expense.note} />}
          {expense.projects    && <Row label="案件" value={expense.projects.name} />}
          {expense.shifts      && (
            <Row label="シフト"
              value={`${expense.shifts.shift_date} ${expense.shifts.start_time?.slice(0,5)}〜${expense.shifts.end_time?.slice(0,5)}`} />
          )}
        </div>
      </div>

      {/* 領収書 */}
      {expense.expense_receipts?.length > 0 && (
        <div className="rounded-[var(--radius-xl)] overflow-hidden"
          style={{ border: '1px solid oklch(0.15 0.003 260)', background: 'oklch(0.09 0.005 255 / 0.8)' }}>
          <p className="px-4 pt-3 text-xs font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>領収書</p>
          {receiptUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={receiptUrl} alt="領収書" className="w-full max-h-64 object-contain m-3"
              style={{ background: 'oklch(0.05 0.002 260)', borderRadius: 8 }} />
          ) : (
            <div className="p-4 text-xs" style={{ color: 'oklch(0.55 0.007 75)' }}>
              {expense.expense_receipts[0].file_name}
            </div>
          )}
        </div>
      )}

      {/* ワークフロー履歴 */}
      <div className="rounded-[var(--radius-xl)] p-4 space-y-3"
        style={{ background: 'oklch(0.09 0.005 255 / 0.8)', border: '1px solid oklch(0.15 0.003 260)' }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: `${GOLD}80` }}>履歴</p>
        <div className="space-y-2">
          <TimeRow icon={Clock} color={GOLD}  label="登録日"   time={expense.created_at} />
          {expense.submitted_at && <TimeRow icon={Send}          color={YELLOW} label="申請日"   time={expense.submitted_at} />}
          {expense.approved_at  && expense.status === 'approved' && <TimeRow icon={CheckCircle2} color={GREEN}  label="承認日" time={expense.approved_at} />}
          {expense.approved_at  && expense.status === 'rejected' && (
            <>
              <TimeRow icon={XCircle} color={RED}  label="却下日" time={expense.approved_at} />
              {expense.reject_reason && (
                <div className="ml-5 pl-3 text-xs py-1.5 rounded"
                  style={{ borderLeft: `2px solid ${RED}40`, color: RED }}>
                  {expense.reject_reason}
                </div>
              )}
            </>
          )}
          {expense.settled_at   && <TimeRow icon={Banknote}      color={CYAN}   label="精算日" time={expense.settled_at} settled_amount={expense.settled_amount} />}
        </div>
      </div>

      {/* アクションボタン */}
      <div className="space-y-3">
        {expense.status === 'draft' && (
          <>
            <button onClick={submit} disabled={acting}
              className="w-full py-4 rounded-[var(--radius-xl)] font-bold text-sm transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, oklch(0.52 0.10 75), ${GOLD})`,
                color: 'oklch(0.06 0.003 260)',
                boxShadow: `0 0 16px ${GOLD}40`,
              }}>
              <span className="flex items-center justify-center gap-2">
                <Send className="h-4 w-4" />
                申請する
              </span>
            </button>
            <button onClick={deleteExpense}
              className="w-full py-3 rounded-[var(--radius-xl)] text-sm font-medium transition-all"
              style={{ background: `${RED}10`, border: `1px solid ${RED}30`, color: RED }}>
              <span className="flex items-center justify-center gap-2">
                <Trash2 className="h-4 w-4" />
                削除する
              </span>
            </button>
          </>
        )}

        {expense.status === 'submitted' && (
          <button onClick={withdraw} disabled={acting}
            className="w-full py-3 rounded-[var(--radius-xl)] text-sm font-medium transition-all"
            style={{ background: 'oklch(0.12 0.003 260)', border: '1px solid oklch(0.20 0.003 260)', color: 'oklch(0.60 0.007 75)' }}>
            <span className="flex items-center justify-center gap-2">
              <Undo2 className="h-4 w-4" />
              申請を取り下げる
            </span>
          </button>
        )}

        {expense.status === 'rejected' && (
          <button onClick={submit} disabled={acting}
            className="w-full py-3 rounded-[var(--radius-xl)] text-sm font-bold transition-all"
            style={{ background: `${YELLOW}15`, border: `1px solid ${YELLOW}40`, color: YELLOW }}>
            却下された内容を修正して再申請
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs shrink-0" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</span>
      <span className="text-xs text-right truncate" style={{ color: 'oklch(0.80 0.008 75)' }}>{value}</span>
    </div>
  )
}

function TimeRow({ icon: Icon, color, label, time, settled_amount }: {
  icon: React.ElementType; color: string; label: string; time: string; settled_amount?: number
}) {
  const d = new Date(time)
  const fmt = d.toLocaleDateString('ja-JP', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      <span className="text-xs" style={{ color: 'oklch(0.60 0.007 75)' }}>{label}</span>
      <span className="text-xs ml-auto tabular-nums" style={{ color: 'oklch(0.55 0.007 75)' }}>{fmt}</span>
      {settled_amount != null && (
        <span className="text-xs font-bold" style={{ color }}>¥{settled_amount.toLocaleString()}</span>
      )}
    </div>
  )
}
