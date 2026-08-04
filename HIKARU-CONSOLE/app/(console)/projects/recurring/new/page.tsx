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
  RecurringPriceCard, BillingInfoCard,
  emptyPrice, emptyBilling,
  type PriceEntry, type BillingEntry,
} from '@/components/console/PricingCard'
import { ArrowLeft, RefreshCw, Calendar, Users } from 'lucide-react'

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

export default function NewRecurringProjectPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [assignees, setAssignees] = React.useState<Assignee[]>([])
  const [prices,  setPrices]  = React.useState<PriceEntry[]>(initPrices())
  const [billing, setBilling] = React.useState<BillingEntry>(emptyBilling())

  // 年間スケジュール（月 → 作業内容テキスト）
  const [monthlyContent, setMonthlyContent] = React.useState<Record<number,string>>(
    Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, '']))
  )

  const [form, setForm] = React.useState({
    name: '', status: 'active', location_name: '', notes: '',
    start_date: '', end_date: '', required_staff: '1',
    cycle_type: 'monthly', work_start_time: '', work_end_time: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }
    setLoading(true)

    const schedules = Object.entries(monthlyContent)
      .filter(([, c]) => c.trim())
      .map(([month, work_content]) => ({ month: parseInt(month), work_content: work_content.trim() }))

    // ① 案件作成
    const projRes = await fetch('/api/projects/recurring', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:          form.name.trim(),
        status:        form.status,
        location_name: form.location_name || null,
        start_date:    form.start_date    || null,
        end_date:      form.end_date      || null,
        notes:         form.notes         || null,
        recurring_details: {
          cycle_type:      form.cycle_type,
          cycle_config:    {},
          required_staff:  parseInt(form.required_staff) || 1,
          work_start_time: form.work_start_time || null,
          work_end_time:   form.work_end_time   || null,
          auto_generate:   true,
        },
        monthly_schedules: schedules,
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

    // ② 月別単価・請求情報を保存（金額が1件以上入力されている場合）
    const filledPrices = prices.filter(p => p.amount_ex_tax > 0)
    if (filledPrices.length > 0 || billing.billing_status !== 'unbilled') {
      await fetch(`/api/projects/${project.id}/pricing`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing, prices: filledPrices }),
      })
    }

    toast.success('定期案件を登録しました')
    router.push(`/projects/recurring/${project.id}`)
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="定期案件を登録"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: '定期案件', href: '/projects/recurring' },
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
                  <RefreshCw className="h-4 w-4" /> 基本情報
                </h2>
                <Input label="案件名 *" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="例: ○○飲食店 定期清掃" required />
                <Input label="作業場所名" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="○○店 / ○○ビル" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="開始日" type="date" value={form.start_date} onChange={e => upd('start_date', e.target.value)} />
                  <Input label="終了日" type="date" value={form.end_date} onChange={e => upd('end_date', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 作業周期 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> 作業周期
                </h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">作業周期</label>
                  <Select value={form.cycle_type} onValueChange={v => upd('cycle_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CYCLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="必要人数" type="number" min="1" value={form.required_staff} onChange={e => upd('required_staff', e.target.value)} />
                  <Input label="作業開始時刻" type="time" value={form.work_start_time} onChange={e => upd('work_start_time', e.target.value)} />
                  <Input label="作業終了時刻" type="time" value={form.work_end_time} onChange={e => upd('work_end_time', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 年間作業スケジュール */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> 年間作業スケジュール
                </h2>
                <p className="text-xs text-[var(--color-muted-foreground)]">月ごとに特別な作業内容を記入してください（省略可）。</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MONTHS.map((label, idx) => (
                    <div key={idx} className="flex items-start gap-3 rounded-[var(--radius)] border border-[var(--color-border)] p-3">
                      <span className="w-10 shrink-0 text-sm font-bold pt-1.5" style={{ color: 'oklch(0.73 0.12 78)' }}>{label}</span>
                      <Textarea
                        value={monthlyContent[idx + 1]}
                        onChange={e => setMonthlyContent(p => ({ ...p, [idx + 1]: e.target.value }))}
                        placeholder="床洗浄・ワックス..."
                        rows={2}
                        className="flex-1 text-xs"
                      />
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

            {/* ★ 年間単価（月別） */}
            <RecurringPriceCard value={prices} onChange={setPrices} />

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
            <Link href="/projects/recurring">
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
