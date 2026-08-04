'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent,
  Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  RecurringPriceCard, BillingInfoCard,
  emptyBilling, emptyPrice, BILLING_STATUSES, fmtJPY,
  type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Edit2, Save, RefreshCw, Calendar, Users, DollarSign } from 'lucide-react'

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']

const CYCLE_OPTIONS = [
  { value: 'daily',       label: '毎日' },
  { value: 'weekly',      label: '毎週' },
  { value: 'monthly',     label: '毎月' },
  { value: 'biweekly',    label: '隔週' },
  { value: 'nth_weekday', label: '第○曜日' },
  { value: 'custom',      label: 'カスタム' },
]

function initPrices(): PriceEntry[] {
  return Array.from({ length: 12 }, (_, i) => ({ ...emptyPrice(), period_month: i + 1 }))
}

function initSchedules(): Record<number, string> {
  return Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, '']))
}

const gold = 'oklch(0.73 0.12 78)'

export default function RecurringProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project,  setProject]  = React.useState<any>(null)
  const [loading,  setLoading]  = React.useState(true)
  const [editing,  setEditing]  = React.useState(false)
  const [saving,   setSaving]   = React.useState(false)
  const [form,     setForm]     = React.useState<any>({})
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [prices,   setPrices]   = React.useState<PriceEntry[]>(initPrices())
  const [billing,  setBilling]  = React.useState<BillingEntry>(emptyBilling())
  // 月次スケジュール（清掃内容）
  const [schedules, setSchedules] = React.useState<Record<number, string>>(initSchedules())

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/recurring/${id}`, { credentials: 'include', cache: 'no-store' }),
      fetch(`/api/projects/${id}/pricing`,   { credentials: 'include', cache: 'no-store' }),
    ])

    if (projRes.ok) {
      const { data } = await projRes.json()
      setProject(data)
      const d = data.recurring_project_details ?? {}

      setForm({
        name:            data.name ?? '',
        status:          data.status ?? 'active',
        location_name:   data.location_name ?? '',
        notes:           data.notes ?? '',
        start_date:      data.start_date ?? '',
        end_date:        data.end_date ?? '',
        cycle_type:      d.cycle_type ?? 'monthly',
        required_staff:  String(d.required_staff ?? 1),
        work_start_time: d.work_start_time ?? '',
        work_end_time:   d.work_end_time   ?? '',
      })

      // 担当者
      setAssignees(
        (data.assignments ?? []).map((a: any) => ({
          assignee_type: a.assignee_type,
          assignee_id:   a.assignee_id,
          label:         a.assignee_id,
        }))
      )

      // ★ 月次スケジュール（DBから取得して表示）
      const sched = initSchedules()
      ;(data.monthly_schedules ?? []).forEach((s: any) => {
        if (s.month >= 1 && s.month <= 12) sched[s.month] = s.work_content ?? ''
      })
      setSchedules(sched)
    }

    if (pricingRes.ok) {
      const { billing: b, prices: ps } = await pricingRes.json()

      if (b) {
        setBilling({
          billing_status:      b.billing_status      ?? 'unbilled',
          quote_number:        b.quote_number        ?? '',
          contract_date:       b.contract_date       ?? '',
          billing_date:        b.billing_date        ?? '',
          payment_due_date:    b.payment_due_date    ?? '',
          actual_payment_date: b.actual_payment_date ?? '',
          notes:               b.notes               ?? '',
        })
      }

      if (ps?.length > 0) {
        const next = initPrices()
        ps.forEach((p: any) => {
          if (p.period_month >= 1 && p.period_month <= 12) {
            next[p.period_month - 1] = {
              period_month:   p.period_month,
              amount_ex_tax:  Number(p.amount_ex_tax),
              tax_rate:       Number(p.tax_rate),
              tax_amount:     Number(p.tax_amount),
              amount_inc_tax: Number(p.amount_inc_tax),
            }
          }
        })
        setPrices(next)
      }
    }

    setLoading(false)
  }

  function upd(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error('案件名を入力してください'); return }
    setSaving(true)

    // 月次スケジュールを配列に変換
    const monthlySchedules = Object.entries(schedules)
      .filter(([, c]) => c.trim())
      .map(([month, work_content]) => ({ month: parseInt(month), work_content: work_content.trim() }))

    const [projRes, pricingRes] = await Promise.all([
      // 案件 + 月次スケジュール更新
      fetch(`/api/projects/recurring/${id}`, {
        method:  'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:          form.name.trim(),
          status:        form.status,
          location_name: form.location_name || null,
          notes:         form.notes         || null,
          start_date:    form.start_date    || null,
          end_date:      form.end_date      || null,
          recurring_details: {
            cycle_type:      form.cycle_type,
            cycle_config:    {},
            required_staff:  parseInt(form.required_staff) || 1,
            work_start_time: form.work_start_time || null,
            work_end_time:   form.work_end_time   || null,
            auto_generate:   true,
          },
          monthly_schedules: monthlySchedules,
          assignments: assignees,
        }),
      }),
      // ★ 単価・請求情報は常に保存（金額0でも請求情報だけ保存可）
      fetch(`/api/projects/${id}/pricing`, {
        method:  'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing,
          prices: prices.filter(p => p.amount_ex_tax > 0),
        }),
      }),
    ])

    if (projRes.ok && pricingRes.ok) {
      toast.success('保存しました')
      setEditing(false)
      await loadData()
    } else {
      const err1 = projRes.ok ? '' : await projRes.json().then(r => r.error).catch(() => 'エラー')
      const err2 = pricingRes.ok ? '' : await pricingRes.json().then(r => r.error).catch(() => 'エラー')
      toast.error('保存に失敗しました: ' + [err1, err2].filter(Boolean).join(' / '))
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!project) {
    return <div className="text-center py-20 text-[var(--color-muted-foreground)]">案件が見つかりません</div>
  }

  const d = project.recurring_project_details ?? {}
  const yearTotal = prices.reduce((s, p) => s + p.amount_inc_tax, 0)
  const yearExTax = prices.reduce((s, p) => s + p.amount_ex_tax, 0)
  const billingStatusLabel = BILLING_STATUSES.find(b => b.value === billing.billing_status)?.label ?? '—'

  return (
    <div>
      <PageHeader
        title={project.name}
        description="定期案件"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: '定期案件', href: '/projects/recurring' },
            { label: project.name },
          ]} />
        }
        actions={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData() }}>
                  キャンセル
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="h-4 w-4" /> 編集
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ── 案件基本情報 ── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <RefreshCw className="h-4 w-4" /> 案件情報
              </h2>
              {editing ? (
                <>
                  <Input label="案件名 *" value={form.name} onChange={e => upd('name', e.target.value)} />
                  <Input label="作業場所" value={form.location_name} onChange={e => upd('location_name', e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="開始日" type="date" value={form.start_date} onChange={e => upd('start_date', e.target.value)} />
                    <Input label="終了日" type="date" value={form.end_date}   onChange={e => upd('end_date',   e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">作業周期</label>
                      <Select value={form.cycle_type} onValueChange={v => upd('cycle_type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CYCLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input label="必要人数" type="number" min="1" value={form.required_staff} onChange={e => upd('required_staff', e.target.value)} />
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="作業開始時刻" type="time" value={form.work_start_time} onChange={e => upd('work_start_time', e.target.value)} />
                    <Input label="作業終了時刻" type="time" value={form.work_end_time}   onChange={e => upd('work_end_time',   e.target.value)} />
                  </div>
                  <Textarea label="備考" value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['作業場所', project.location_name ?? '—'],
                    ['作業周期', CYCLE_OPTIONS.find(o => o.value === d.cycle_type)?.label ?? '—'],
                    ['期間',     [project.start_date, project.end_date].filter(Boolean).map((dt: string) => new Date(dt).toLocaleDateString('ja-JP')).join(' 〜 ') || '—'],
                    ['必要人数', `${d.required_staff ?? '—'}名`],
                    ['作業時間', d.work_start_time && d.work_end_time ? `${d.work_start_time} 〜 ${d.work_end_time}` : '—'],
                    ['備考',     project.notes ?? '—'],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <dt className="text-[var(--color-muted-foreground)]">{l}</dt>
                      <dd className="font-medium mt-0.5">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* ── 担当者（編集時のみ） ── */}
          {editing && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <AssigneeSelector value={assignees} onChange={setAssignees} />
              </CardContent>
            </Card>
          )}

          {/* ── ★ 年間作業スケジュール（閲覧・編集） ── */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-4 w-4" /> 年間作業スケジュール
              </h2>
              {editing ? (
                <>
                  <p className="text-xs text-[var(--color-muted-foreground)]">月ごとの清掃内容を入力してください。</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MONTHS.map((label, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                        <span className="w-10 shrink-0 text-sm font-bold pt-1.5" style={{ color: gold }}>{label}</span>
                        <Textarea
                          value={schedules[idx + 1] ?? ''}
                          onChange={e => setSchedules(p => ({ ...p, [idx + 1]: e.target.value }))}
                          placeholder="床洗浄・ワックス..."
                          rows={2}
                          className="flex-1 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                // ★ 閲覧モード：月次スケジュールを表示
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MONTHS.map((label, idx) => {
                    const content = schedules[idx + 1]
                    return (
                      <div key={idx} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2.5">
                        <span className="w-10 shrink-0 text-sm font-bold" style={{ color: gold }}>{label}</span>
                        <span className="text-sm text-[var(--color-foreground)]">
                          {content ? content : <span className="text-[var(--color-muted-foreground)]">—</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── ★ 年間単価（閲覧・編集） ── */}
          {editing ? (
            <RecurringPriceCard value={prices} onChange={setPrices} />
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> 年間単価
                  </h2>
                  <span className="text-sm font-bold" style={{ color: gold }}>
                    年間（税込）: {yearTotal > 0 ? fmtJPY(yearTotal) : '—'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {prices.map((p, i) => (
                    <div key={i} className="flex items-center justify-between rounded-[var(--radius)] border border-[var(--color-border)] px-3 py-2">
                      <span className="text-sm font-bold" style={{ color: gold }}>{MONTHS[i]}</span>
                      <span className="text-xs font-mono">
                        {p.amount_inc_tax > 0
                          ? <span style={{ color: 'oklch(0.85 0.008 75)' }}>{p.amount_inc_tax.toLocaleString('ja-JP')}円</span>
                          : <span className="text-[var(--color-muted-foreground)]">—</span>
                        }
                      </span>
                    </div>
                  ))}
                </div>
                {yearTotal > 0 && (
                  <div className="rounded-[var(--radius)] p-3 text-sm space-y-1"
                    style={{ background: `${gold}0d`, border: `1px solid ${gold}30` }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'oklch(0.55 0.007 75)' }}>年間税抜合計</span>
                      <span className="font-mono">{fmtJPY(yearExTax)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span style={{ color: gold }}>年間税込合計</span>
                      <span className="font-mono" style={{ color: gold }}>{fmtJPY(yearTotal)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── ★ 請求情報（閲覧・編集） ── */}
          {editing ? (
            <BillingInfoCard value={billing} onChange={setBilling} />
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">請求情報</h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['請求状況',   billingStatusLabel],
                    ['見積番号',   billing.quote_number        || '—'],
                    ['契約日',     billing.contract_date       || '—'],
                    ['請求予定日', billing.billing_date        || '—'],
                    ['入金予定日', billing.payment_due_date    || '—'],
                    ['入金日',     billing.actual_payment_date || '—'],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <dt className="text-[var(--color-muted-foreground)]">{l}</dt>
                      <dd className="font-medium mt-0.5">{v}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── サイドバー ── */}
        <div className="space-y-4">
          <Link href="/projects/recurring">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> 一覧へ戻る
            </Button>
          </Link>

          {/* 担当者（閲覧時） */}
          {!editing && assignees.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-2">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <ul className="space-y-1 text-sm">
                  {assignees.map((a, i) => (
                    <li key={i} className="text-[var(--color-foreground)]">
                      {a.assignee_type === 'employee' ? '従業員' : '協力業者'}: {a.label}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
