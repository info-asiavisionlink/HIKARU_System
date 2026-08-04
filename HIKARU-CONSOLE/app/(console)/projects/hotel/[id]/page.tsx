'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PageHeader, Button, Input, Textarea, Card, CardContent, Badge, Skeleton, toast, Breadcrumb } from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard, emptyBilling, emptyPrice,
  BILLING_STATUSES, fmtJPY, type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Edit2, Save, Hotel, Layers, Clock, Wrench, Users, Plus, Trash2 } from 'lucide-react'

interface FloorRow     { id?: string; floor_name: string; room_count: string }
interface StaffingRow  { id?: string; time_slot: string; required_staff: string }
interface WorkAreaRow  { id?: string; name: string; description: string }

export default function HotelProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving,  setSaving]  = React.useState(false)
  const [form, setForm] = React.useState<any>({})
  const [floors,   setFloors]   = React.useState<FloorRow[]>([])
  const [staffing, setStaffing] = React.useState<StaffingRow[]>([])
  const [areas,    setAreas]    = React.useState<WorkAreaRow[]>([])
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [price,   setPrice]   = React.useState<PriceEntry>(emptyPrice())
  const [billing, setBilling] = React.useState<BillingEntry>(emptyBilling())

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/hotel/${id}`, { credentials: 'include', cache: 'no-store' }),
      fetch(`/api/projects/${id}/pricing`, { credentials: 'include', cache: 'no-store' }),
    ])
    if (projRes.ok) {
      const { data } = await projRes.json()
      setProject(data)
      const d = data.hotel_project_details
      setForm({
        name: data.name, status: data.status, location_name: data.location_name ?? '', notes: data.notes ?? '',
        total_floors: String(d?.total_floors ?? ''), operating_start_time: d?.operating_start_time ?? '',
        operating_end_time: d?.operating_end_time ?? '', manager_name: d?.manager_name ?? '', phone: d?.phone ?? '',
        contract_start_date: d?.contract_start_date ?? '', contract_end_date: d?.contract_end_date ?? '',
      })
      setFloors((data.floors ?? []).map((f: any) => ({ id: f.id, floor_name: f.floor_name, room_count: String(f.room_count) })))
      setStaffing((data.staffing_rules ?? []).map((s: any) => ({ id: s.id, time_slot: s.time_slot, required_staff: String(s.required_staff) })))
      setAreas((data.work_areas ?? []).map((a: any) => ({ id: a.id, name: a.name, description: a.description ?? '' })))
      setAssignees((data.assignments ?? []).map((a: any) => ({ assignee_type: a.assignee_type, assignee_id: a.assignee_id, label: a.assignee_id })))
    }
    if (pricingRes.ok) {
      const { billing: b, prices: ps } = await pricingRes.json()
      if (b) setBilling({ billing_status: b.billing_status ?? 'unbilled', quote_number: b.quote_number ?? '', contract_date: b.contract_date ?? '', billing_date: b.billing_date ?? '', payment_due_date: b.payment_due_date ?? '', actual_payment_date: b.actual_payment_date ?? '', notes: b.notes ?? '' })
      if (ps?.[0]) {
        const p = ps[0]
        setPrice({ amount_ex_tax: Number(p.amount_ex_tax), tax_rate: Number(p.tax_rate), tax_amount: Number(p.tax_amount), amount_inc_tax: Number(p.amount_inc_tax), unit_price: p.unit_price ? Number(p.unit_price) : null, quantity: p.quantity ?? null })
      }
    }
    setLoading(false)
  }

  function upd(k: string, v: string) { setForm((p: any) => ({ ...p, [k]: v })) }

  async function handleSave() {
    setSaving(true)
    const [projRes, pricingRes] = await Promise.all([
      fetch(`/api/projects/hotel/${id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, status: form.status,
          location_name: form.location_name || null, notes: form.notes || null,
          hotel_details: { total_floors: parseInt(form.total_floors)||0, operating_start_time: form.operating_start_time||null, operating_end_time: form.operating_end_time||null, manager_name: form.manager_name||null, phone: form.phone||null, contract_start_date: form.contract_start_date||null, contract_end_date: form.contract_end_date||null, auto_generate: true },
          floors:         floors.filter(f => f.floor_name).map((f, i) => ({ floor_name: f.floor_name, room_count: parseInt(f.room_count)||0, order_num: i })),
          staffing_rules: staffing.filter(s => s.time_slot).map((s, i) => ({ time_slot: s.time_slot, required_staff: parseInt(s.required_staff)||0, order_num: i })),
          work_areas:     areas.filter(a => a.name).map((a, i) => ({ name: a.name, description: a.description||null, order_num: i })),
          assignments:    assignees,
        }),
      }),
      fetch(`/api/projects/${id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing, prices: [{ ...price, period_month: null }] }),
      }),
    ])
    if (projRes.ok && pricingRes.ok) { toast.success('保存しました'); setEditing(false); await loadData() }
    else toast.error('保存に失敗しました')
    setSaving(false)
  }

  const totalRooms = floors.reduce((s, f) => s + (parseInt(f.room_count) || 0), 0)

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-96 w-full" /></div>
  if (!project) return <div className="text-center py-20 text-[var(--color-muted-foreground)]">案件が見つかりません</div>

  const d = project.hotel_project_details

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={<Breadcrumb items={[{ label: '案件管理', href: '/projects' }, { label: 'ホテル案件', href: '/projects/hotel' }, { label: project.name }]} />}
        actions={
          <div className="flex gap-2">
            {editing
              ? <><Button variant="outline" size="sm" onClick={() => { setEditing(false); loadData() }}>キャンセル</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving}><Save className="h-4 w-4" />{saving ? '保存中...' : '保存'}</Button></>
              : <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Edit2 className="h-4 w-4" /> 編集</Button>
            }
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* ホテル基本情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Hotel className="h-4 w-4" /> ホテル情報
              </h2>
              {editing ? (
                <>
                  <Input label="ホテル名 *" value={form.name} onChange={e => upd('name', e.target.value)} />
                  <Input label="住所" value={form.location_name} onChange={e => upd('location_name', e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="担当責任者" value={form.manager_name} onChange={e => upd('manager_name', e.target.value)} />
                    <Input label="電話番号" type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Input label="総階数" type="number" value={form.total_floors} onChange={e => upd('total_floors', e.target.value)} />
                    <Input label="稼働開始" type="time" value={form.operating_start_time} onChange={e => upd('operating_start_time', e.target.value)} />
                    <Input label="稼働終了" type="time" value={form.operating_end_time} onChange={e => upd('operating_end_time', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="契約開始日" type="date" value={form.contract_start_date} onChange={e => upd('contract_start_date', e.target.value)} />
                    <Input label="契約終了日" type="date" value={form.contract_end_date} onChange={e => upd('contract_end_date', e.target.value)} />
                  </div>
                  <Textarea label="備考" value={form.notes} onChange={e => upd('notes', e.target.value)} rows={2} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['住所',     project.location_name ?? '—'],
                    ['担当',     d?.manager_name ?? '—'],
                    ['電話',     d?.phone ?? '—'],
                    ['総階数',   d?.total_floors ? `${d.total_floors}階` : '—'],
                    ['稼働時間', d?.operating_start_time && d?.operating_end_time ? `${d.operating_start_time} 〜 ${d.operating_end_time}` : '—'],
                    ['契約期間', [d?.contract_start_date, d?.contract_end_date].filter(Boolean).join(' 〜 ') || '—'],
                    ['総客室数', `${totalRooms}室`],
                  ].map(([l,v]) => <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>)}
                </dl>
              )}
            </CardContent>
          </Card>

          {/* フロア情報 */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4" /> フロア情報
                </h2>
                {editing && <Button type="button" variant="outline" size="sm" onClick={() => setFloors(f => [...f, { floor_name: '', room_count: '' }])}><Plus className="h-3.5 w-3.5" /></Button>}
              </div>
              {editing ? (
                <div className="space-y-2">
                  {floors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="w-24" placeholder="1F" value={f.floor_name} onChange={e => setFloors(arr => arr.map((r, j) => j===i ? {...r, floor_name: e.target.value} : r))} />
                      <Input className="w-28" type="number" placeholder="部屋数" value={f.room_count} onChange={e => setFloors(arr => arr.map((r, j) => j===i ? {...r, room_count: e.target.value} : r))} />
                      <span className="text-sm text-[var(--color-muted-foreground)]">室</span>
                      <button type="button" onClick={() => setFloors(arr => arr.filter((_, j) => j!==i))} className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {project.floors?.map((f: any) => (
                    <div key={f.id} className="rounded border border-[var(--color-border)] px-3 py-2 text-sm">
                      <p className="font-bold" style={{ color: 'oklch(0.73 0.12 78)' }}>{f.floor_name}</p>
                      <p className="text-[var(--color-muted-foreground)]">{f.room_count}室</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 稼働管理 */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Clock className="h-4 w-4" /> 稼働管理
                </h2>
                {editing && <Button type="button" variant="outline" size="sm" onClick={() => setStaffing(s => [...s, { time_slot: '', required_staff: '' }])}><Plus className="h-3.5 w-3.5" /></Button>}
              </div>
              {editing ? (
                <div className="space-y-2">
                  {staffing.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input className="w-28" placeholder="朝/昼/夜" value={s.time_slot} onChange={e => setStaffing(arr => arr.map((r, j) => j===i ? {...r, time_slot: e.target.value} : r))} />
                      <Input className="w-24" type="number" placeholder="人数" value={s.required_staff} onChange={e => setStaffing(arr => arr.map((r, j) => j===i ? {...r, required_staff: e.target.value} : r))} />
                      <span className="text-sm text-[var(--color-muted-foreground)]">名</span>
                      <button type="button" onClick={() => setStaffing(arr => arr.filter((_, j) => j!==i))} className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {project.staffing_rules?.map((s: any) => (
                    <div key={s.id} className="rounded border border-[var(--color-border)] px-4 py-2 text-sm text-center">
                      <p className="font-bold" style={{ color: 'oklch(0.73 0.12 78)' }}>{s.time_slot}</p>
                      <p className="text-[var(--color-muted-foreground)]">{s.required_staff}名</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 作業エリア */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> 作業エリア
                </h2>
                {editing && <Button type="button" variant="outline" size="sm" onClick={() => setAreas(a => [...a, { name: '', description: '' }])}><Plus className="h-3.5 w-3.5" /></Button>}
              </div>
              {editing ? (
                <div className="space-y-2">
                  {areas.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="w-36" placeholder="エリア名" value={a.name} onChange={e => setAreas(arr => arr.map((r, j) => j===i ? {...r, name: e.target.value} : r))} />
                      <Input className="flex-1" placeholder="説明" value={a.description} onChange={e => setAreas(arr => arr.map((r, j) => j===i ? {...r, description: e.target.value} : r))} />
                      <button type="button" onClick={() => setAreas(arr => arr.filter((_, j) => j!==i))} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.work_areas?.map((a: any) => (
                    <span key={a.id} className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs">{a.name}</span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {editing && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <AssigneeSelector value={assignees} onChange={setAssignees} />
              </CardContent>
            </Card>
          )}

          {/* 単価（ホテルモード：1室単価 × 客室数） */}
          {editing
            ? <SinglePriceCard value={price} onChange={setPrice} title="1室単価" hotelMode totalRooms={totalRooms} />
            : (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">単価・売上</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ['1室単価（税抜）', price.unit_price ? fmtJPY(price.unit_price) : '—'],
                      ['客室数',          price.quantity  ? `${price.quantity}室` : `${totalRooms}室`],
                      ['税抜売上',        price.amount_ex_tax  > 0 ? fmtJPY(price.amount_ex_tax)  : '—'],
                      ['消費税',          price.tax_amount     > 0 ? fmtJPY(price.tax_amount)     : '—'],
                      ['税込売上',        price.amount_inc_tax > 0 ? fmtJPY(price.amount_inc_tax) : '—'],
                    ].map(([l,v]) => <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-bold mt-0.5" style={{ color: l === '税込売上' ? 'oklch(0.73 0.12 78)' : undefined }}>{v}</dd></div>)}
                  </dl>
                </CardContent>
              </Card>
            )
          }

          {editing
            ? <BillingInfoCard value={billing} onChange={setBilling} />
            : (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">請求情報</h2>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {[
                      ['請求状況', BILLING_STATUSES.find(b => b.value === billing.billing_status)?.label ?? '—'],
                      ['契約日',   billing.contract_date || '—'],
                      ['請求予定日', billing.billing_date || '—'],
                      ['入金予定日', billing.payment_due_date || '—'],
                    ].map(([l,v]) => <div key={l}><dt className="text-[var(--color-muted-foreground)]">{l}</dt><dd className="font-medium mt-0.5">{v}</dd></div>)}
                  </dl>
                </CardContent>
              </Card>
            )
          }
        </div>

        <div><Link href="/projects/hotel"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> 一覧へ</Button></Link></div>
      </div>
    </div>
  )
}
