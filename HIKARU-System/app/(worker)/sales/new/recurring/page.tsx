'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Card, CardContent, Button, Input, Textarea, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  PageHeader, Breadcrumb,
} from '@hikaru/ui'
import { ProposalDocUpload, type UploadedDoc } from '@/components/sales/ProposalDocUpload'
import { ArrowLeft, RefreshCw, Calendar, Plus, Trash2 } from 'lucide-react'

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
const CYCLE_OPTIONS = [
  { value: 'monthly', label: '毎月' }, { value: 'biweekly', label: '隔週' },
  { value: 'weekly', label: '毎週' }, { value: 'daily', label: '毎日' },
  { value: 'nth_weekday', label: '第○曜日' }, { value: 'custom', label: 'カスタム' },
]

export default function NewRecurringProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [keys,  setKeys]  = React.useState<{model: string; usage: string}[]>([{model: '', usage: ''}])
  const [docs,  setDocs]  = React.useState<UploadedDoc[]>([])
  const [monthlyContent, setMonthlyContent] = React.useState<Record<number,string>>(
    Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, '']))
  )

  const [form, setForm] = React.useState({
    name: '', client_name: '', client_phone: '', client_email: '',
    location_name: '', address: '', start_date: '', end_date: '',
    cycle_type: 'monthly', required_staff: '1', work_start_time: '', work_end_time: '',
    entry_route: '', key_borrowing: 'false', estimated_amount: '', notes: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function addKey()  { setKeys(p => [...p, {model: '', usage: ''}]) }
  function updKey(i: number, f: 'model' | 'usage', v: string) { setKeys(p => p.map((k, j) => j === i ? {...k, [f]: v} : k)) }
  function rmKey(i: number)  { setKeys(p => p.length <= 1 ? [{model: '', usage: ''}] : p.filter((_, j) => j !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }
    setLoading(true)

    const schedules = Object.entries(monthlyContent)
      .filter(([, c]) => c.trim())
      .map(([month, content]) => `${month}月: ${content}`)
      .join('\n')

    const res = await fetch('/api/proposals', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name:     form.name.trim(),
        project_type:     'recurring',
        client_name:      form.client_name      || null,
        client_phone:     form.client_phone     || null,
        client_email:     form.client_email     || null,
        location_name:    form.location_name    || null,
        location_address: form.address          || null,
        estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : null,
        start_date:       form.start_date       || null,
        end_date:         form.end_date         || null,
        work_description: [
          `【作業周期】${CYCLE_OPTIONS.find(o => o.value === form.cycle_type)?.label ?? form.cycle_type}`,
          form.required_staff !== '1' ? `【必要人数】${form.required_staff}名` : '',
          form.work_start_time ? `【作業時間】${form.work_start_time}〜${form.work_end_time}` : '',
        ].filter(Boolean).join('\n') || null,
        notes: [
          form.notes,
          schedules ? `【年間作業スケジュール】\n${schedules}` : '',
          form.entry_route ? `【入館経路】${form.entry_route}` : '',
          form.key_borrowing === 'true' && keys[0].model ? `【鍵】${keys.map(k=>`${k.model}(${k.usage})`).join('、')}` : '',
        ].filter(Boolean).join('\n') || null,
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
        title="定期案件を提案"
        description="入力後に管理者が確認・承認します"
        breadcrumb={
          <Breadcrumb items={[
            { label: '営業成績', href: '/sales' },
            { label: '案件提案', href: '/sales/new' },
            { label: '定期案件' },
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
                <Input label="予定金額（月額・円）" type="number" value={form.estimated_amount} onChange={e => upd('estimated_amount', e.target.value)} placeholder="80000" />
                <Input label="作業場所名" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="○○店 / ○○ビル" />
                <Input label="住所" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="例: 東京都渋谷区○○1-2-3" />
                <div className="grid grid-cols-2 gap-4">
                  <Input label="開始日" type="date" value={form.start_date} onChange={e => upd('start_date', e.target.value)} />
                  <Input label="終了日" type="date" value={form.end_date} onChange={e => upd('end_date', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* クライアント */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">クライアント情報</h2>
                <Input label="クライアント名" value={form.client_name} onChange={e => upd('client_name', e.target.value)} placeholder="株式会社○○" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" type="tel" value={form.client_phone} onChange={e => upd('client_phone', e.target.value)} />
                  <Input label="メールアドレス" type="email" value={form.client_email} onChange={e => upd('client_email', e.target.value)} />
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

            {/* 入館・鍵情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">入館・鍵情報</h2>
                <Textarea label="入館経路・入室経路" value={form.entry_route} onChange={e => upd('entry_route', e.target.value)} placeholder="例: 1Fエントランス→エレベーター→3F右" rows={2} />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">鍵の借用</label>
                  <Select value={form.key_borrowing} onValueChange={v => upd('key_borrowing', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">なし</SelectItem>
                      <SelectItem value="true">あり</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.key_borrowing === 'true' && (
                  <div className="space-y-3">
                    {keys.map((k, i) => (
                      <div key={i} className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold" style={{color: 'var(--color-primary)'}}>鍵 {i + 1}</span>
                          {keys.length > 1 && <button type="button" onClick={() => rmKey(i)} className="p-1" style={{color: 'var(--color-error-foreground)'}}><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="型番" value={k.model} onChange={e => updKey(i, 'model', e.target.value)} placeholder="例: MIWA LA" />
                          <Input label="使用箇所" value={k.usage} onChange={e => updKey(i, 'usage', e.target.value)} placeholder="例: 玄関" />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={addKey}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius)] text-sm border-dashed hover:opacity-80"
                      style={{border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)'}}>
                      <Plus className="h-4 w-4" /> 鍵を追加する
                    </button>
                  </div>
                )}
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
                      <Textarea value={monthlyContent[idx + 1]} onChange={e => setMonthlyContent(p => ({ ...p, [idx + 1]: e.target.value }))}
                        placeholder="床洗浄・ワックス..." rows={2} className="flex-1 text-xs" />
                    </div>
                  ))}
                </div>
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
