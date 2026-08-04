'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader, Button, Input, Textarea, Card, CardContent, Badge, Skeleton, toast, Breadcrumb, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard, emptyBilling, emptyPrice,
  BILLING_STATUSES, type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Edit2, Save, Trash2, Zap } from 'lucide-react'

const statusVariant: Record<string, string> = { active: 'success', paused: 'warning', completed: 'secondary', cancelled: 'destructive' }
const statusLabel: Record<string, string>   = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }

export default function SpotProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving,  setSaving]  = React.useState(false)
  const [form, setForm] = React.useState<any>({})
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [price,   setPrice]   = React.useState<PriceEntry>(emptyPrice())
  const [billing, setBilling] = React.useState<BillingEntry>(emptyBilling())

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/spot/${id}`, { credentials: 'include', cache: 'no-store' }),
      fetch(`/api/projects/${id}/pricing`, { credentials: 'include', cache: 'no-store' }),
    ])

    if (projRes.ok) {
      const { data } = await projRes.json()
      setProject(data)
      const d = data.spot_project_details
      setForm({
        name: data.name, status: data.status, location_name: data.location_name ?? '',
        notes: data.notes ?? '',
        work_datetime:   d?.work_datetime   ? d.work_datetime.slice(0,16) : '',
        work_content:    d?.work_content    ?? '',
        required_staff:  String(d?.required_staff ?? 1),
        estimated_hours: String(d?.estimated_hours ?? ''),
      })
      setAssignees(
        (data.project_assignments ?? []).map((a: any) => ({
          assignee_type: a.assignee_type, assignee_id: a.assignee_id, label: a.assignee_id,
        }))
      )
    }

    if (pricingRes.ok) {
      const { billing: b, prices: ps } = await pricingRes.json()
      if (b)  setBilling({ billing_status: b.billing_status ?? 'unbilled', quote_number: b.quote_number ?? '', contract_date: b.contract_date ?? '', billing_date: b.billing_date ?? '', payment_due_date: b.payment_due_date ?? '', actual_payment_date: b.actual_payment_date ?? '', notes: b.notes ?? '' })
      if (ps?.[0]) {
        const p = ps[0]
        setPrice({ amount_ex_tax: Number(p.amount_ex_tax), tax_rate: Number(p.tax_rate), tax_amount: Number(p.tax_amount), amount_inc_tax: Number(p.amount_inc_tax) })
      }
    }

    setLoading(false)
  }

  function upd(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/spot/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, status: form.status,
          location_name: form.location_name || null, notes: form.notes || null,
          spot_details: {
            work_datetime: form.work_datetime || null, work_content: form.work_content || null,
            required_staff: parseInt(form.required_staff) || 1,
            estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
          },
          assignments: assignees,
        }),
      }),
      fetch(`/api/projects/${id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing, prices: [{ ...price, period_month: null }] }),
      }),
    ])

    if (projRes.ok && pricingRes.ok) {
      toast.success('保存しました')
      setEditing(false)
      await loadData()
    } else {
      toast.error('保存に失敗しました')
    }
    setSaving(false)
  }

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>
  if (!project) return <div className="text-center py-20 text-[var(--color-muted-foreground)]">案件が見つかりません</div>

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={<Breadcrumb items={[{ label: '案件管理', href: '/projects' }, { label: '単発案件', href: '/projects/spot' }, { label: project.name }]} />}
        actions={
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData() }}>キャンセル</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4" /> 編集</Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* 案件情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4" /> 案件情報
              </h2>
              {editing ? (
                <>
                  <Input label="案件名 *" value={form.name} onChange={e => upd('name', e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="作業日時" type="datetime-local" value={form.work_datetime} onChange={e => upd('work_datetime', e.target.value)} />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">ステータス</label>
                      <Select value={form.status} onValueChange={v => upd('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(statusLabel).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Textarea label="作業内容" value={form.work_content} onChange={e => upd('work_content', e.target.value)} rows={3} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="必要人数" type="number" min="1" value={form.required_staff} onChange={e => upd('required_staff', e.target.value)} />
                    <Input label="予定時間（h）" type="number" step="0.5" value={form.estimated_hours} onChange={e => upd('estimated_hours', e.target.value)} />
                  </div>
                  <Input label="場所" value={form.location_name} onChange={e => upd('location_name', e.target.value)} />
                  <Textarea label="備考" value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['ステータス', <Badge key="s" variant={statusVariant[project.status] as any}>{statusLabel[project.status]}</Badge>],
                    ['作業日時',   project.spot_project_details?.work_datetime ? new Date(project.spot_project_details.work_datetime).toLocaleString('ja-JP') : '—'],
                    ['作業内容',   project.spot_project_details?.work_content ?? '—'],
                    ['必要人数',   `${project.spot_project_details?.required_staff ?? '—'}名`],
                    ['予定時間',   project.spot_project_details?.estimated_hours ? `${project.spot_project_details.estimated_hours}h` : '—'],
                    ['場所',       project.location_name ?? '—'],
                    ['備考',       project.notes ?? '—'],
                  ].map(([label, val]) => (
                    <div key={String(label)}><dt className="text-[var(--color-muted-foreground)]">{label}</dt><dd className="font-medium mt-0.5">{val}</dd></div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* 担当者 */}
          {editing && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">担当者</h2>
                <AssigneeSelector value={assignees} onChange={setAssignees} />
              </CardContent>
            </Card>
          )}

          {/* 金額 */}
          {editing
            ? <SinglePriceCard value={price} onChange={setPrice} title="契約金額" />
            : (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">契約金額</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ['税抜金額', price.amount_ex_tax > 0 ? price.amount_ex_tax.toLocaleString('ja-JP')+'円' : '—'],
                      ['消費税',   price.tax_amount > 0 ? price.tax_amount.toLocaleString('ja-JP')+'円' : '—'],
                      ['税込合計', price.amount_inc_tax > 0 ? price.amount_inc_tax.toLocaleString('ja-JP')+'円' : '—'],
                    ].map(([l,v]) => <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-bold mt-0.5" style={{ color: 'oklch(0.73 0.12 78)' }}>{v}</dd></div>)}
                  </dl>
                </CardContent>
              </Card>
            )
          }

          {/* 請求情報 */}
          {editing
            ? <BillingInfoCard value={billing} onChange={setBilling} />
            : (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">請求情報</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ['請求状況', BILLING_STATUSES.find(b => b.value === billing.billing_status)?.label ?? '—'],
                      ['見積番号', billing.quote_number || '—'],
                      ['契約日',   billing.contract_date || '—'],
                      ['請求予定日', billing.billing_date || '—'],
                      ['入金予定日', billing.payment_due_date || '—'],
                      ['入金日',   billing.actual_payment_date || '—'],
                    ].map(([l,v]) => <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>)}
                  </dl>
                </CardContent>
              </Card>
            )
          }
        </div>

        <div className="space-y-4">
          <Link href="/projects/spot"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> 一覧へ</Button></Link>
        </div>
      </div>
    </div>
  )
}
