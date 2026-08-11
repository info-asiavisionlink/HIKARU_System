'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Card, CardContent, Button, Input, Textarea, toast,
  PageHeader, Breadcrumb,
} from '@hikaru/ui'
import { ProposalDocUpload, type UploadedDoc } from '@/components/sales/ProposalDocUpload'
import { ArrowLeft, Hotel, Layers, Clock, Wrench, Plus, Trash2 } from 'lucide-react'

interface FloorRow    { floor_name: string; room_count: string }
interface StaffingRow { time_slot: string;  required_staff: string }
interface WorkAreaRow { name: string;       description: string }

const DEFAULT_STAFFING: StaffingRow[] = [
  { time_slot: '朝', required_staff: '' },
  { time_slot: '昼', required_staff: '' },
  { time_slot: '夜', required_staff: '' },
]
const DEFAULT_WORK_AREAS: WorkAreaRow[] = [
  { name: '部屋清掃', description: '' }, { name: '共用部', description: '' },
  { name: '廊下', description: '' },     { name: 'トイレ', description: '' },
  { name: 'ロビー', description: '' },   { name: 'エレベーター', description: '' },
  { name: 'バックヤード', description: '' },
]

export default function NewHotelProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [floors,    setFloors]    = React.useState<FloorRow[]>([{ floor_name: '1F', room_count: '' }])
  const [staffing,  setStaffing]  = React.useState<StaffingRow[]>(DEFAULT_STAFFING)
  const [workAreas, setWorkAreas] = React.useState<WorkAreaRow[]>(DEFAULT_WORK_AREAS)
  const [docs, setDocs] = React.useState<UploadedDoc[]>([])
  const [spots, setSpots] = React.useState<string[]>([''])

  const [form, setForm] = React.useState({
    name: '', client_name: '', client_phone: '', client_email: '',
    location_name: '', address: '', manager_name: '', phone: '',
    total_floors: '', operating_start_time: '', operating_end_time: '',
    contract_start_date: '', contract_end_date: '',
    estimated_amount: '', notes: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function addSpot() { setSpots(p => [...p, '']) }
  function updSpot(i: number, v: string) { setSpots(p => p.map((s, j) => j === i ? v : s)) }
  function rmSpot(i: number) { setSpots(p => p.length <= 1 ? [''] : p.filter((_, j) => j !== i)) }
  function updFloor(i: number, k: keyof FloorRow, v: string) { setFloors(f => f.map((r, j) => j === i ? {...r, [k]: v} : r)) }
  function updStaffing(i: number, k: keyof StaffingRow, v: string) { setStaffing(s => s.map((r, j) => j === i ? {...r, [k]: v} : r)) }
  function updArea(i: number, k: keyof WorkAreaRow, v: string) { setWorkAreas(a => a.map((r, j) => j === i ? {...r, [k]: v} : r)) }

  const totalRooms = React.useMemo(() => floors.reduce((s, f) => s + (parseInt(f.room_count) || 0), 0), [floors])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('ホテル名を入力してください'); return }
    setLoading(true)

    const floorInfo = floors.filter(f => f.floor_name.trim()).map(f => `${f.floor_name}: ${f.room_count}室`).join('、')
    const staffInfo = staffing.filter(s => s.time_slot && s.required_staff).map(s => `${s.time_slot}: ${s.required_staff}名`).join('、')
    const areaInfo  = workAreas.filter(a => a.name.trim()).map(a => a.description ? `${a.name}(${a.description})` : a.name).join('、')
    const spotInfo  = spots.filter(s => s.trim()).join('、')

    const res = await fetch('/api/proposals', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name:     form.name.trim(),
        project_type:     'hotel',
        client_name:      form.client_name      || null,
        client_phone:     form.client_phone || form.phone || null,
        client_email:     form.client_email     || null,
        location_name:    form.location_name    || null,
        location_address: form.address          || null,
        estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : null,
        start_date:       form.contract_start_date || null,
        end_date:         form.contract_end_date   || null,
        work_description: [
          floorInfo     ? `【フロア情報】${floorInfo} (合計${totalRooms}室)` : '',
          staffInfo     ? `【必要人数】${staffInfo}` : '',
          areaInfo      ? `【作業エリア】${areaInfo}` : '',
          spotInfo      ? `【撮影箇所】${spotInfo}` : '',
          form.operating_start_time ? `【稼働時間】${form.operating_start_time}〜${form.operating_end_time}` : '',
          form.manager_name ? `【担当責任者】${form.manager_name}` : '',
        ].filter(Boolean).join('\n') || null,
        notes: form.notes || null,
        documents: docs,
      }),
    })

    if (res.ok) {
      toast.success('案件提案を送信しました。管理者が確認します。')
      router.push('/sales')
    } else {
      const j = await res.json()
      toast.error(j.error ?? '送信に失敗しました')
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-4">
      <PageHeader
        brand="HIKARU WORKER"
        title="ホテル案件を提案"
        description="入力後に管理者が確認・承認します"
        breadcrumb={
          <Breadcrumb items={[
            { label: '営業成績', href: '/sales' },
            { label: '案件提案', href: '/sales/new' },
            { label: 'ホテル案件' },
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
                <Input label="施設名・通称" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="例: ○○ホテル別館" />
                <Input label="住所" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="例: 東京都渋谷区○○1-2-3" />
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
                <Input label="予定金額（月額・円）" type="number" value={form.estimated_amount} onChange={e => upd('estimated_amount', e.target.value)} placeholder="500000" />
              </CardContent>
            </Card>

            {/* クライアント */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">クライアント情報</h2>
                <Input label="クライアント名" value={form.client_name} onChange={e => upd('client_name', e.target.value)} placeholder="○○ホテルグループ" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" type="tel" value={form.client_phone} onChange={e => upd('client_phone', e.target.value)} />
                  <Input label="メールアドレス" type="email" value={form.client_email} onChange={e => upd('client_email', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* フロア情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Layers className="h-4 w-4" /> フロア情報
                    {totalRooms > 0 && <span className="text-xs font-normal" style={{ color: 'oklch(0.73 0.12 78)' }}>合計 {totalRooms}室</span>}
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
                      <button type="button" onClick={() => setFloors(arr => arr.filter((_, j) => j !== i))} className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
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
                      <button type="button" onClick={() => setStaffing(arr => arr.filter((_, j) => j !== i))} className="ml-auto text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
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
                      <button type="button" onClick={() => setWorkAreas(arr => arr.filter((_, j) => j !== i))} className="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 作業箇所（撮影箇所） */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所（撮影箇所）</h2>
                  <button type="button" onClick={addSpot}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius)] transition-all"
                    style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    <Plus className="h-3.5 w-3.5" /> 箇所を追加
                  </button>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">作業者が写真を撮影する箇所を追加してください（例: ロビー、客室、大浴場）。</p>
                <div className="space-y-2">
                  {spots.map((spot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {i + 1}
                      </div>
                      <Input value={spot} onChange={e => updSpot(i, e.target.value)} placeholder={i === 0 ? '例: ロビー清掃' : '作業箇所名'} className="flex-1" />
                      <button type="button" onClick={() => rmSpot(i)} className="p-1.5 rounded hover:opacity-80 shrink-0" style={{ color: 'var(--color-error-foreground)' }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addSpot}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-lg)] text-sm border-dashed hover:opacity-80"
                  style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}>
                  <Plus className="h-4 w-4" /> 箇所を追加する
                </button>
              </CardContent>
            </Card>

            {/* 添付ファイル */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">添付ファイル</h2>
                <ProposalDocUpload value={docs} onChange={setDocs} />
              </CardContent>
            </Card>

            {/* 備考 */}
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">備考</h2>
                <Textarea value={form.notes} onChange={e => upd('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 h-fit lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
            {totalRooms > 0 && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">合計 {totalRooms}室</p>
                  <div className="space-y-1">
                    {floors.filter(f => f.floor_name.trim()).map((f, i) => (
                      <div key={i} className="flex justify-between text-xs text-[var(--color-muted-foreground)]">
                        <span>{f.floor_name}</span><span>{f.room_count}室</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="pt-6 space-y-2 text-xs text-[var(--color-muted-foreground)]">
                <p className="font-semibold text-[var(--color-foreground)]">提案の流れ</p>
                <p>1. 提案を送信する</p>
                <p>2. 管理者が確認・承認</p>
                <p>3. 承認後に正式な案件として登録</p>
              </CardContent>
            </Card>
            <Button type="submit" disabled={loading} className="w-full">{loading ? '送信中...' : '提案を送信する'}</Button>
            <Link href="/sales/new"><Button type="button" variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> キャンセル</Button></Link>
          </div>
        </div>
      </form>
    </div>
  )
}
