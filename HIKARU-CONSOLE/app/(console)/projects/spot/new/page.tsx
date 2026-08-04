'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { AssigneeSelector, type Assignee } from '@/components/console/AssigneeSelector'
import {
  SinglePriceCard, BillingInfoCard,
  emptyPrice, emptyBilling,
  type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, Zap, MapPin, Users } from 'lucide-react'

export default function NewSpotProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [price,   setPrice]   = React.useState<PriceEntry>(emptyPrice())
  const [billing, setBilling] = React.useState<BillingEntry>(emptyBilling())

  const [form, setForm] = React.useState({
    name: '', status: 'active', location_name: '', notes: '',
    work_datetime: '', work_content: '',
    required_staff: '1', estimated_hours: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }
    setLoading(true)

    // ① 案件作成
    const projRes = await fetch('/api/projects/spot', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          form.name.trim(),
        status:        form.status,
        location_name: form.location_name || null,
        notes:         form.notes         || null,
        spot_details: {
          work_datetime:   form.work_datetime   || null,
          work_content:    form.work_content    || null,
          required_staff:  parseInt(form.required_staff) || 1,
          estimated_hours: form.estimated_hours ? parseFloat(form.estimated_hours) : null,
        },
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

    // ② 単価・請求情報を保存
    if (price.amount_ex_tax > 0 || billing.billing_status !== 'unbilled') {
      await fetch(`/api/projects/${project.id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billing,
          prices: [{ ...price, period_month: null }],
        }),
      })
    }

    toast.success('単発案件を登録しました')
    router.push(`/projects/spot/${project.id}`)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="単発案件を登録"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: '単発案件', href: '/projects/spot' },
            { label: '新規登録' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Zap className="h-4 w-4" /> 基本情報
                </h2>
                <Input
                  label="案件名 *"
                  value={form.name}
                  onChange={e => upd('name', e.target.value)}
                  placeholder="例: ○○マンション 退去後清掃"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="作業日時"
                    type="datetime-local"
                    value={form.work_datetime}
                    onChange={e => upd('work_datetime', e.target.value)}
                  />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">ステータス</label>
                    <Select value={form.status} onValueChange={v => upd('status', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">稼働中</SelectItem>
                        <SelectItem value="paused">停止中</SelectItem>
                        <SelectItem value="completed">完了</SelectItem>
                        <SelectItem value="cancelled">キャンセル</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea
                  label="作業内容"
                  value={form.work_content}
                  onChange={e => upd('work_content', e.target.value)}
                  placeholder="床洗浄・ワックス施工、ガラス清掃..."
                  rows={3}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="必要人数"
                    type="number" min="1"
                    value={form.required_staff}
                    onChange={e => upd('required_staff', e.target.value)}
                  />
                  <Input
                    label="予定時間（時間）"
                    type="number" step="0.5" min="0"
                    value={form.estimated_hours}
                    onChange={e => upd('estimated_hours', e.target.value)}
                    placeholder="3.5"
                  />
                </div>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 作業場所
                </h2>
                <Input
                  label="場所名"
                  value={form.location_name}
                  onChange={e => upd('location_name', e.target.value)}
                  placeholder="○○マンション 301号室"
                />
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

            {/* ★ 契約金額（単価） */}
            <SinglePriceCard
              value={price}
              onChange={setPrice}
              title="契約金額"
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

          {/* サイドボタン */}
          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登録中...' : '登録する'}
            </Button>
            <Link href="/projects/spot">
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
