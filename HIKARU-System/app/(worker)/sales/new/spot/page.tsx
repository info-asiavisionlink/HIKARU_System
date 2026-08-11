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
import { ArrowLeft, Zap, MapPin, Plus, Trash2 } from 'lucide-react'

export default function NewSpotProposalPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [spots, setSpots] = React.useState<string[]>([''])
  const [keys,  setKeys]  = React.useState<{model: string; usage: string}[]>([{model: '', usage: ''}])
  const [docs,  setDocs]  = React.useState<UploadedDoc[]>([])

  const [form, setForm] = React.useState({
    name: '', code: '', client_name: '', client_phone: '', client_email: '',
    start_date: '', end_date: '', work_start_time: '', work_end_time: '',
    location_name: '', address: '', phone: '', emergency_contact: '', business_hours: '',
    work_content: '', required_staff: '1', estimated_hours: '',
    entry_route: '', key_borrowing: 'false', estimated_amount: '', notes: '',
  })

  function upd(k: string, v: string) { setForm(p => ({ ...p, [k]: v })) }
  function addSpot() { setSpots(p => [...p, '']) }
  function updSpot(i: number, v: string) { setSpots(p => p.map((s, j) => j === i ? v : s)) }
  function rmSpot(i: number)  { setSpots(p => p.length <= 1 ? [''] : p.filter((_, j) => j !== i)) }
  function addKey()  { setKeys(p => [...p, {model: '', usage: ''}]) }
  function updKey(i: number, f: 'model' | 'usage', v: string) { setKeys(p => p.map((k, j) => j === i ? {...k, [f]: v} : k)) }
  function rmKey(i: number)  { setKeys(p => p.length <= 1 ? [{model: '', usage: ''}] : p.filter((_, j) => j !== i)) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }
    setLoading(true)

    const res = await fetch('/api/proposals', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_name:     form.name.trim(),
        project_type:     'spot',
        client_name:      form.client_name      || null,
        client_phone:     form.client_phone     || null,
        client_email:     form.client_email     || null,
        location_name:    form.location_name    || null,
        location_address: form.address          || null,
        work_description: form.work_content     || null,
        estimated_amount: form.estimated_amount ? Number(form.estimated_amount) : null,
        start_date:       form.start_date       || null,
        end_date:         form.end_date         || null,
        notes: [
          form.notes,
          spots.filter(s=>s.trim()).length > 0 ? `【作業箇所】${spots.filter(s=>s.trim()).join('、')}` : '',
          form.entry_route ? `【入館経路】${form.entry_route}` : '',
          form.key_borrowing === 'true' && keys[0].model ? `【鍵】${keys.map(k=>`${k.model}(${k.usage})`).join('、')}` : '',
          form.business_hours ? `【作業可能時間】${form.business_hours}` : '',
          form.required_staff !== '1' ? `【必要人数】${form.required_staff}名` : '',
          form.estimated_hours ? `【予定時間】${form.estimated_hours}時間` : '',
          form.emergency_contact ? `【緊急連絡先】${form.emergency_contact}` : '',
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
        title="単発案件を提案"
        description="入力後に管理者が確認・承認します"
        breadcrumb={
          <Breadcrumb items={[
            { label: '営業成績', href: '/sales' },
            { label: '案件提案', href: '/sales/new' },
            { label: '単発案件' },
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
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="案件名 *" value={form.name} onChange={e => upd('name', e.target.value)} placeholder="例: ○○マンション 退去後清掃" required />
                  <Input label="予定金額（円）" type="number" value={form.estimated_amount} onChange={e => upd('estimated_amount', e.target.value)} placeholder="150000" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="開始日" type="date" value={form.start_date} onChange={e => upd('start_date', e.target.value)} />
                  <Input label="終了日" type="date" value={form.end_date} onChange={e => upd('end_date', e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="作業開始時間" type="time" value={form.work_start_time} onChange={e => upd('work_start_time', e.target.value)} />
                  <Input label="作業終了時間" type="time" value={form.work_end_time} onChange={e => upd('work_end_time', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* クライアント */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">クライアント情報</h2>
                <Input label="クライアント名" value={form.client_name} onChange={e => upd('client_name', e.target.value)} placeholder="株式会社○○" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" type="tel" value={form.client_phone} onChange={e => upd('client_phone', e.target.value)} placeholder="03-0000-0000" />
                  <Input label="メールアドレス" type="email" value={form.client_email} onChange={e => upd('client_email', e.target.value)} placeholder="contact@example.com" />
                </div>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 作業場所
                </h2>
                <Input label="作業場所名" value={form.location_name} onChange={e => upd('location_name', e.target.value)} placeholder="例: ○○マンション 301号室" />
                <Input label="住所" value={form.address} onChange={e => upd('address', e.target.value)} placeholder="例: 東京都渋谷区○○1-2-3" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="現場の電話番号" />
                  <Input label="緊急連絡先" value={form.emergency_contact} onChange={e => upd('emergency_contact', e.target.value)} placeholder="緊急時の連絡先" />
                </div>
                <Input label="作業可能時間帯" value={form.business_hours} onChange={e => upd('business_hours', e.target.value)} placeholder="例: 平日 9:00〜18:00" />
              </CardContent>
            </Card>

            {/* 作業箇所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所</h2>
                  <button type="button" onClick={addSpot}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[var(--radius)] transition-all"
                    style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                    <Plus className="h-3.5 w-3.5" /> 箇所を追加
                  </button>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">清掃・点検する箇所を追加してください（例: エアコン清掃、床清掃）。</p>
                <div className="space-y-2">
                  {spots.map((spot, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {i + 1}
                      </div>
                      <Input value={spot} onChange={e => updSpot(i, e.target.value)}
                        placeholder={i === 0 ? '例: エアコン清掃' : i === 1 ? '例: 床清掃' : '作業箇所名'} className="flex-1" />
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

            {/* 作業詳細 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業詳細</h2>
                <Textarea label="作業内容" value={form.work_content} onChange={e => upd('work_content', e.target.value)} placeholder="床洗浄・ワックス施工、ガラス清掃..." rows={3} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="必要人数" type="number" min="1" value={form.required_staff} onChange={e => upd('required_staff', e.target.value)} />
                  <Input label="予定時間（時間）" type="number" step="0.5" min="0" value={form.estimated_hours} onChange={e => upd('estimated_hours', e.target.value)} placeholder="3.5" />
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

            {/* 添付ファイル */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">添付ファイル</h2>
                <p className="text-xs text-[var(--color-muted-foreground)]">外観写真・作業箇所写真・パンフレット・契約書を添付できます。</p>
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

          {/* 右カラム */}
          <div className="flex flex-col gap-4 h-fit lg:sticky lg:top-[calc(var(--header-height)+1rem)]">
            {spots.some(s => s.trim()) && (
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所 ({spots.filter(s => s.trim()).length})</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {spots.filter(s => s.trim()).map((s, i) => (
                      <span key={i} className="text-xs px-2 py-1 rounded-[var(--radius)]"
                        style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                        {s}
                      </span>
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
