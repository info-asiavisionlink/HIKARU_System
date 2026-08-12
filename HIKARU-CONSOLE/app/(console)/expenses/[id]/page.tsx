'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader, Breadcrumb, Button } from '@hikaru/ui'
import { CheckCircle2, XCircle, Banknote, Clock, Receipt, User, MapPin, CalendarDays, ChevronLeft } from 'lucide-react'

const GOLD   = 'oklch(0.73 0.12 78)'
const GREEN  = 'oklch(0.72 0.18 150)'
const RED    = 'oklch(0.65 0.22 25)'
const CYAN   = 'oklch(0.85 0.18 198)'
const YELLOW = 'oklch(0.80 0.18 85)'

const CATEGORY_LABELS: Record<string, string> = {
  transport: '交通費', parking: '駐車場代', supplies: '備品', consumables: '消耗品', other: 'その他',
}
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: '下書き',   color: 'oklch(0.45 0.005 75)' },
  submitted: { label: '申請中',   color: YELLOW },
  approved:  { label: '承認済み', color: GREEN },
  rejected:  { label: '却下',     color: RED },
  settled:   { label: '精算済み', color: CYAN },
  withdrawn: { label: '取り下げ', color: 'oklch(0.40 0.005 75)' },
}

export default function ExpenseDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const id      = params.id as string

  const [expense,      setExpense]      = React.useState<any>(null)
  const [loading,      setLoading]      = React.useState(true)
  const [rejectReason, setRejectReason] = React.useState('')
  const [showReject,   setShowReject]   = React.useState(false)
  const [acting,       setActing]       = React.useState(false)
  const [receiptUrl,   setReceiptUrl]   = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/expenses/${id}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setExpense(d.expense) })
      .finally(() => setLoading(false))
  }, [id])

  React.useEffect(() => {
    if (!expense?.expense_receipts?.length) return
    const path = expense.expense_receipts[0].storage_path
    fetch(`/api/receipts/signed-url?path=${encodeURIComponent(path)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setReceiptUrl(d.url) })
  }, [expense])

  async function approve() {
    setActing(true)
    const res = await fetch(`/api/expenses/${id}/approve`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      const { expense: updated } = await res.json()
      setExpense((prev: any) => ({ ...prev, ...updated }))
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '承認に失敗しました')
    }
    setActing(false)
  }

  async function reject() {
    if (!rejectReason.trim()) { alert('却下理由を入力してください'); return }
    setActing(true)
    const res = await fetch(`/api/expenses/${id}/reject`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reject_reason: rejectReason }),
    })
    if (res.ok) {
      const { expense: updated } = await res.json()
      setExpense((prev: any) => ({ ...prev, ...updated }))
      setShowReject(false)
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '却下に失敗しました')
    }
    setActing(false)
  }

  async function settle() {
    if (!confirm('この経費を精算済みにしますか？')) return
    setActing(true)
    const res = await fetch(`/api/expenses/${id}/settle`, { method: 'POST', credentials: 'include' })
    if (res.ok) {
      const { expense: updated } = await res.json()
      setExpense((prev: any) => ({ ...prev, ...updated }))
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error ?? '精算に失敗しました')
    }
    setActing(false)
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="h-6 w-6 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: `${GOLD}60`, borderTopColor: 'transparent' }} />
    </div>
  )

  if (!expense) return (
    <div className="p-8 text-center" style={{ color: 'oklch(0.50 0.007 75)' }}>
      経費が見つかりません
    </div>
  )

  const st = STATUS_CONFIG[expense.status] ?? STATUS_CONFIG.draft

  return (
    <div>
      <PageHeader
        title="経費詳細"
        breadcrumb={
          <Breadcrumb items={[{ label: '経費管理', href: '/expenses' }, { label: '詳細' }]} />
        }
        actions={
          <span className="text-sm font-bold px-3 py-1.5 rounded-[var(--radius)]"
            style={{ background: `${st.color}18`, color: st.color, border: `1px solid ${st.color}30` }}>
            {st.label}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">

          {/* 経費情報 */}
          <Section title="経費情報">
            <InfoRow label="申請者"    value={expense.profile?.name ?? '—'} />
            <InfoRow label="種別"      value={expense.assignee_type === 'employee' ? '従業員' : expense.assignee_type === 'partner' ? '協力業者' : '—'} />
            {expense.employees && (
              <InfoRow label="従業員名" value={`${expense.employees.name}${expense.employees.department ? `（${expense.employees.department}）` : ''}`} />
            )}
            {expense.partners && (
              <InfoRow label="協力業者" value={expense.partners.company_name} />
            )}
            <InfoRow label="カテゴリー" value={CATEGORY_LABELS[expense.category] ?? expense.category} />
            <InfoRow label="金額"
              value={<span className="text-lg font-black" style={{ color: GOLD }}>¥{expense.amount?.toLocaleString()}</span>} />
            <InfoRow label="発生日" value={expense.expense_date} />
            {expense.description && <InfoRow label="内容" value={expense.description} />}
            {expense.note        && <InfoRow label="備考" value={expense.note} />}
          </Section>

          {/* 関連データ */}
          {(expense.projects || expense.shifts || expense.jobs) && (
            <Section title="関連データ">
              {expense.projects && (
                <InfoRow label="案件" value={
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    {expense.projects.name}
                    {expense.projects.location_name && ` (${expense.projects.location_name})`}
                  </span>
                } />
              )}
              {expense.shifts && (
                <InfoRow label="シフト" value={
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    {expense.shifts.shift_date} {expense.shifts.start_time?.slice(0, 5)}〜{expense.shifts.end_time?.slice(0, 5)}
                  </span>
                } />
              )}
              {expense.jobs && (
                <InfoRow label="JOB" value={expense.jobs.work_date} />
              )}
            </Section>
          )}

          {/* 領収書 */}
          <Section title="領収書">
            {expense.expense_receipts?.length > 0 ? (
              receiptUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiptUrl} alt="領収書" className="max-h-80 object-contain rounded-[var(--radius-lg)]"
                  style={{ background: 'oklch(0.05 0.002 260)' }} />
              ) : (
                <p className="text-sm" style={{ color: 'oklch(0.55 0.007 75)' }}>
                  {expense.expense_receipts[0].file_name}
                  {expense.expense_receipts[0].file_size != null &&
                    ` (${Math.round(expense.expense_receipts[0].file_size / 1024)}KB)`}
                </p>
              )
            ) : (
              <p className="text-sm" style={{ color: 'oklch(0.40 0.005 75)' }}>領収書なし</p>
            )}
          </Section>

          {/* ワークフロー履歴 */}
          <Section title="ワークフロー履歴">
            <TimeEntry icon={Clock} color={GOLD}  label="登録"   time={expense.created_at} />
            {expense.submitted_at && <TimeEntry icon={Clock}       color={YELLOW} label="申請"   time={expense.submitted_at} />}
            {expense.approved_at && expense.status !== 'rejected' && (
              <TimeEntry icon={CheckCircle2} color={GREEN}
                label={`承認（${expense.approver?.name ?? '管理者'}）`}
                time={expense.approved_at} />
            )}
            {expense.approved_at && expense.status === 'rejected' && (
              <>
                <TimeEntry icon={XCircle} color={RED}
                  label={`却下（${expense.approver?.name ?? '管理者'}）`}
                  time={expense.approved_at} />
                {expense.reject_reason && (
                  <div className="ml-6 mt-1 pl-3 py-1.5 text-xs rounded"
                    style={{ borderLeft: `2px solid ${RED}40`, color: RED }}>
                    {expense.reject_reason}
                  </div>
                )}
              </>
            )}
            {expense.settled_at && (
              <TimeEntry icon={Banknote} color={CYAN}
                label={`精算（${expense.settler?.name ?? '管理者'}）¥${expense.settled_amount?.toLocaleString()}`}
                time={expense.settled_at} />
            )}
          </Section>
        </div>

        {/* 右カラム: アクション */}
        <div className="space-y-4 h-fit lg:sticky lg:top-[calc(var(--header-height)+1rem)]">

          {/* 承認・却下 */}
          {expense.status === 'submitted' && (
            <div className="rounded-[var(--radius-lg)] p-4 space-y-3"
              style={{ background: 'oklch(0.06 0.003 260)', border: `1px solid ${YELLOW}30` }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: YELLOW }}>承認・却下</p>
              <Button className="w-full" onClick={approve} disabled={acting}>
                <CheckCircle2 className="h-4 w-4" /> 承認する
              </Button>
              {!showReject ? (
                <Button variant="outline" className="w-full" onClick={() => setShowReject(true)} disabled={acting}>
                  <XCircle className="h-4 w-4" /> 却下する
                </Button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="却下理由を入力（必須）"
                    rows={3}
                    className="w-full px-3 py-2 rounded-[var(--radius)] text-sm border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-foreground)] outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={reject} disabled={acting || !rejectReason.trim()}
                      style={{ background: `${RED}22`, borderColor: `${RED}40`, color: RED }}>
                      却下確定
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => { setShowReject(false); setRejectReason('') }}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 精算 */}
          {expense.status === 'approved' && (
            <div className="rounded-[var(--radius-lg)] p-4 space-y-3"
              style={{ background: 'oklch(0.06 0.003 260)', border: `1px solid ${GREEN}30` }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: GREEN }}>精算</p>
              <p className="text-sm" style={{ color: 'oklch(0.70 0.007 75)' }}>
                精算額: <span className="font-bold" style={{ color: GOLD }}>¥{expense.amount?.toLocaleString()}</span>
              </p>
              <Button className="w-full" onClick={settle} disabled={acting}>
                <Banknote className="h-4 w-4" /> 精算済みにする
              </Button>
            </div>
          )}

          {/* 申請者情報 */}
          <div className="rounded-[var(--radius-lg)] p-4 space-y-2"
            style={{ background: 'oklch(0.06 0.003 260)', border: '1px solid oklch(0.14 0.003 260)' }}>
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: `${GOLD}70` }}>申請者</p>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" style={{ color: GOLD }} />
              <span className="text-sm font-medium" style={{ color: 'oklch(0.85 0.008 75)' }}>
                {expense.profile?.name ?? '—'}
              </span>
            </div>
            {expense.profile?.email && (
              <p className="text-xs" style={{ color: 'oklch(0.50 0.007 75)' }}>{expense.profile.email}</p>
            )}
          </div>

          {/* 戻るボタン */}
          <button onClick={() => router.push('/expenses')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius)] text-sm transition-all"
            style={{ color: 'oklch(0.55 0.007 75)', border: '1px solid oklch(0.15 0.003 260)' }}>
            <ChevronLeft className="h-4 w-4" />
            経費一覧に戻る
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-lg)] overflow-hidden"
      style={{ border: '1px solid oklch(0.14 0.003 260)' }}>
      <div className="px-4 py-2.5"
        style={{ background: 'oklch(0.08 0.003 260)', borderBottom: '1px solid oklch(0.13 0.003 260)' }}>
        <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: `${GOLD}80` }}>{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2.5" style={{ background: 'oklch(0.06 0.003 260)' }}>{children}</div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-xs shrink-0" style={{ color: 'oklch(0.50 0.007 75)' }}>{label}</span>
      <span className="text-xs text-right" style={{ color: 'oklch(0.82 0.008 75)' }}>{value}</span>
    </div>
  )
}

function TimeEntry({ icon: Icon, color, label, time }: {
  icon: React.ElementType; color: string; label: string; time: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      <span className="text-xs" style={{ color: 'oklch(0.65 0.007 75)' }}>{label}</span>
      <span className="text-xs ml-auto tabular-nums" style={{ color: 'oklch(0.50 0.007 75)' }}>
        {new Date(time).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}
