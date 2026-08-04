'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
} from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard,
  emptyPrice, emptyBilling,
  type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Hotel, Layers, Clock, Wrench, Users, Plus, Trash2 } from 'lucide-react'

interface FloorRow    { floor_name: string; room_count: string }
interface StaffingRow { time_slot: string;  required_staff: string }
interface WorkAreaRow { name: string;       description: string }

const DEFAULT_STAFFING: StaffingRow[] = [
  { time_slot: '朝', required_staff: '' },
  { time_slot: '昼', required_staff: '' },
  { time_slot: '夜', required_staff: '' },
]
const DEFAULT_WORK_AREAS: WorkAreaRow[] = [
  { name: '部屋清掃',     description: '' },
  { name: '共用部',       description: '' },
  { name: '廊下',         description: '' },
  { name: 'トイレ',       description: '' },
  { name: 'ロビー',       description: '' },
  { name: 'エレベーター', description: '' },
  { name: 'バックヤード', description: '' },
]

export default function NewHotelProjectPage() {
  const router = useRouter()
  const [loading,  setLoading]  = React.useState(false)
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [floors,   setFloors]   = React.useState<FloorRow[]>([{ floor_name: '1F', room_count: '' }])
  const [staffing, setStaffing] = React.useState<StaffingRow[]>(DEFAULT_STAFFING)
  const [workAreas, setWorkAreas] = React.useState<WorkAreaRow[]>(DEFAULT_WORK_AREAS)
  const [price,    setPrice]    = React.useState<PriceEntry>(emptyPrice())
  const [billing,  setBilling]  = React.useState<BillingEntry>(emptyBilling())

  const [form, setForm] = React.useState({
    name: '', status: 'active', location_name: '', notes: '',
    total_floors: '', operating_start_time: '', operating_end_time: '',
    manager_name: '', phone: '',
    contract_start_date: '', contract_end_date: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  // フロアの合計客室数
  const totalRooms = React.useMemo(
    () => floors.reduce((s, f) => s + (parseInt(f.room_count) || 0), 0),
    [floors]
  )

  function updFloor(i: number, k: keyof FloorRow, v: string) {
    setFloors(f => f.map((r, j) => j === i ? { ...r, [k]: v } : r))
  }
  function updStaffing(i: number, k: keyof StaffingRow, v: string) {
    setStaffing(s => s.map((r, j) => j === i ? { ...r, [k]: v } : r))
  }
  function updArea(i: number, k: keyof WorkAreaRow, v: string) {
    setWorkAreas(a => a.map((r, j) => j === i ? { ...r, [k]: v } : r))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('ホテル名を入力してください'); return }
    setLoading(true)

    // ① 案件作成
    const projRes = await fetch('/api/projects/hotel', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          form.name.trim(),
        status:        form.status,
        location_name: form.location_name || null,
        notes:         form.notes         || null,
        hotel_details: {
          total_floors:          parseInt(form.total_floors) || totalRooms > 0 ? floors.length : 0,
          operating_start_time:  form.operating_start_time  || null,
          operating_end_time:    form.operating_end_time    || null,
          manager_name:          form.manager_name           || null,
          phone:                 form.phone                  || null,
          contract_start_date:   form.contract_start_date   || null,
          contract_end_date:     form.contract_end_date     || null,
          auto_generate:         true,
        },
        floors: floors
          .filter(f => f.floor_name.trim())
          .map((f, i) => ({ floor_name: f.floor_name.trim(), room_count: parseInt(f.room_count) || 0, order_num: i })),
        staffing_rules: staffing
          .filter(s => s.time_slot.trim())
          .map((s, i) => ({ time_slot: s.time_slot.trim(), required_staff: parseInt(s.required_staff) || 0, order_num: i })),
        work_areas: workAreas
          .filter(a => a.name.trim())
          .map((a, i) => ({ name: a.name.trim(), description: a.description || null, order_num: i })),
        assignments: assignees,
      }),
    })

    if (!projRes.ok) {
      const { error } = await projRes.json()
      toast.error('登録に失敗しました: ' + error)
      setLoading(false)
      return
    }

    const { data: project } = await projRes.json()

    // ② 単価・請求情報を保存（unit_price または billing 情報がある場合）
    if (price.unit_price || price.amount_ex_tax > 0 || billing.billing_status !== 'unbilled') {
      await fetch(`/api/projects/${project.id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing,
          prices: [{ ...price, period_month: null, quantity: price.quantity ?? totalRooms }],
        }),
      })
    }

    toast.success('ホテル案件を登録しました')
    router.push(`/projects/hotel/${project.id}`)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="ホテル案件を登録"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: 'ホテル案件', href: '/projects/hotel' },
            { label: '新規登録' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* ホテル基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Hotel className="h-4 w-4" /> ホテル基本情報
                </h2>
                <Input label="ホテル名 *" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="○○ホテル" required />
                <Input label="住所" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="東京都○○区..." />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="担当責任者" value={form.manager_name} onChange={e => upd('manager_name', e.target.value)} />
                  <Input label="電話番号" type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="総階数" type="number" min="1" value={form.total_floors} onChange={e => upd('total_floors', e.target.value)} placeholder="10" />
                  <Input label="稼働開始時間" type="time" value={form.operating_start_time} onChange={e => upd('operating_start_time', e.target.value)} />
                  <Input label="稼働終了時間" type="time" value={form.operating_end_time} onChange={e => upd('operating_end_time', e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="契約開始日" type="date" value={form.contract_start_date} onChange={e => upd('contract_start_date', e.target.value)} />
                  <Input label="契約終了日" type="date" value={form.contract_end_date} onChange={e => upd('contract_end_date', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* フロア情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4" /> フロア情報
                    {totalRooms > 0 && (
                      <span className="ml-2 text-xs font-normal" style={{ color: 'oklch(0.73 0.12 78)' }}>
                        合計 {totalRooms}室
                      </span>
                    )}
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => setFloors(f => [...f, { floor_name: '', room_count: '' }])}>
                    <Plus className="h-3.5 w-3.5" /> フロア追加
                  </Button>
                </div>
                <div className="space-y-2">
                  {floors.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="w-24" placeholder="1F" value={f.floor_name} onChange={e => updFloor(i, 'floor_name', e.target.value)} />
                      <Input className="w-28" type="number" min="0" placeholder="部屋数" value={f.room_count} onChange={e => updFloor(i, 'room_count', e.target.value)} />
                      <span className="text-sm text-[var(--color-muted-foreground)]">室</span>
                      <button type="button" onClick={() => setFloors(arr => arr.filter((_, j) => j !== i))}
                        className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 稼働管理 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Clock className="h-4 w-4" /> 稼働管理（必要人数）
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => setStaffing(s => [...s, { time_slot: '', required_staff: '' }])}>
                    <Plus className="h-3.5 w-3.5" /> 追加
                  </Button>
                </div>
                <div className="space-y-2">
                  {staffing.map((s, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input className="w-28" placeholder="朝 / 昼 / 夜" value={s.time_slot} onChange={e => updStaffing(i, 'time_slot', e.target.value)} />
                      <Input className="w-24" type="number" min="0" placeholder="人数" value={s.required_staff} onChange={e => updStaffing(i, 'required_staff', e.target.value)} />
                      <span className="text-sm text-[var(--color-muted-foreground)]">名</span>
                      <button type="button" onClick={() => setStaffing(arr => arr.filter((_, j) => j !== i))}
                        className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 作業エリア */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Wrench className="h-4 w-4" /> 作業エリア
                  </h2>
                  <Button type="button" variant="outline" size="sm" onClick={() => setWorkAreas(a => [...a, { name: '', description: '' }])}>
                    <Plus className="h-3.5 w-3.5" /> エリア追加
                  </Button>
                </div>
                <div className="space-y-2">
                  {workAreas.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input className="w-36" placeholder="作業エリア名" value={a.name} onChange={e => updArea(i, 'name', e.target.value)} />
                      <Input className="flex-1" placeholder="説明（任意）" value={a.description} onChange={e => updArea(i, 'description', e.target.value)} />
                      <button type="button" onClick={() => setWorkAreas(arr => arr.filter((_, j) => j !== i))}
                        className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 担当者 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <AssigneeSelector value={assignees} onChange={setAssignees} />
              </CardContent>
            </Card>

            {/* ★ 1室単価（フロア合計を自動参照） */}
            <SinglePriceCard
              value={price}
              onChange={setPrice}
              title="1室単価・売上"
              hotelMode
              totalRooms={totalRooms}
            />

            {/* ★ 請求情報 */}
            <BillingInfoCard value={billing} onChange={setBilling} />

            {/* 備考 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">備考</h2>
                <Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>

          </div>

          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登録中...' : '登録する'}
            </Button>
            <Link href="/projects/hotel">
              <Button type="button" variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4" /> キャンセル
              </Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
