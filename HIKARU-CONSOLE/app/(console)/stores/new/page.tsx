'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createStore } from '@/services/stores.service'
import { listClients } from '@/services/clients.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { ArrowLeft } from 'lucide-react'

export default function NewStorePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultClientId = searchParams.get('client_id') ?? ''

  const [loading, setLoading] = React.useState(false)
  const [clients, setClients] = React.useState<any[]>([])
  const [form, setForm] = React.useState({
    client_id: defaultClientId,
    name: '', code: '', address: '', phone: '',
    business_hours: '', manager_name: '', emergency_contact: '', contract_info: '', notes: '',
  })

  React.useEffect(() => {
    listClients({ activeOnly: true, pageSize: 500 }).then(({ data }) => setClients(data ?? []))
  }, [])

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim())      { toast.error('店舗名を入力してください');  return }
    if (!form.client_id)        { toast.error('顧客を選択してください');    return }

    setLoading(true)
    const { error } = await createStore({
      client_id:         form.client_id,
      name:              form.name.trim(),
      code:              form.code.trim()              || null,
      address:           form.address.trim()           || null,
      phone:             form.phone.trim()             || null,
      business_hours:    form.business_hours.trim()    || null,
      manager_name:      form.manager_name.trim()      || null,
      emergency_contact: form.emergency_contact.trim() || null,
      contract_info:     form.contract_info.trim()     || null,
      notes:             form.notes.trim()             || null,
    })

    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('店舗を作成しました')
      router.push('/stores')
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="新規店舗"
        breadcrumb={<Breadcrumb items={[{ label: '店舗管理', href: '/stores' }, { label: '新規店舗' }]} />}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">顧客 *</label>
                  <Select value={form.client_id} onValueChange={(v) => update('client_id', v)}>
                    <SelectTrigger><SelectValue placeholder="顧客を選択" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="店舗名 *" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="○○店" required />
                  <Input label="店舗コード" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="STR-001" />
                </div>
                <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="東京都渋谷区..." />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="03-xxxx-xxxx" />
                  <Input label="営業時間" value={form.business_hours} onChange={(e) => update('business_hours', e.target.value)} placeholder="9:00-22:00" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">責任者・契約</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="責任者" value={form.manager_name} onChange={(e) => update('manager_name', e.target.value)} placeholder="山田 太郎" />
                  <Input label="緊急連絡先" value={form.emergency_contact} onChange={(e) => update('emergency_contact', e.target.value)} placeholder="090-xxxx-xxxx" />
                </div>
                <Textarea label="契約情報" value={form.contract_info} onChange={(e) => update('contract_info', e.target.value)} rows={3} />
                <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '保存中...' : '店舗を作成'}
            </Button>
            <Link href="/stores">
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
