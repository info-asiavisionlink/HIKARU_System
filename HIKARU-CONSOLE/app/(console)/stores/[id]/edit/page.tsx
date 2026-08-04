'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { getStore, updateStore } from '@/services/stores.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb, Skeleton, Switch,
} from '@hikaru/ui'
import { ArrowLeft } from 'lucide-react'

export default function EditStorePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [fetching, setFetching] = React.useState(true)
  const [form, setForm] = React.useState({
    name: '', code: '', address: '', phone: '',
    business_hours: '', manager_name: '', emergency_contact: '',
    contract_info: '', notes: '', is_active: true,
  })

  React.useEffect(() => {
    getStore(id).then(({ data }) => {
      if (data) {
        setForm({
          name:              data.name ?? '',
          code:              data.code ?? '',
          address:           data.address ?? '',
          phone:             data.phone ?? '',
          business_hours:    data.business_hours ?? '',
          manager_name:      data.manager_name ?? '',
          emergency_contact: data.emergency_contact ?? '',
          contract_info:     data.contract_info ?? '',
          notes:             data.notes ?? '',
          is_active:         data.is_active ?? true,
        })
      }
      setFetching(false)
    })
  }, [id])

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('店舗名を入力してください'); return }
    setLoading(true)
    const { error } = await updateStore(id, {
      name:              form.name.trim(),
      code:              form.code.trim()              || null,
      address:           form.address.trim()           || null,
      phone:             form.phone.trim()             || null,
      business_hours:    form.business_hours.trim()    || null,
      manager_name:      form.manager_name.trim()      || null,
      emergency_contact: form.emergency_contact.trim() || null,
      contract_info:     form.contract_info.trim()     || null,
      notes:             form.notes.trim()             || null,
      is_active:         form.is_active,
    })
    if (error) { toast.error('保存に失敗しました') }
    else { toast.success('店舗情報を更新しました'); router.push(`/stores/${id}`) }
    setLoading(false)
  }

  if (fetching) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>

  return (
    <div>
      <PageHeader
        title="店舗を編集"
        breadcrumb={<Breadcrumb items={[{ label: '店舗管理', href: '/stores' }, { label: form.name, href: `/stores/${id}` }, { label: '編集' }]} />}
      />
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="店舗名 *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                  <Input label="店舗コード" value={form.code} onChange={(e) => update('code', e.target.value)} />
                </div>
                <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  <Input label="営業時間" value={form.business_hours} onChange={(e) => update('business_hours', e.target.value)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">責任者・契約</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="責任者" value={form.manager_name} onChange={(e) => update('manager_name', e.target.value)} />
                  <Input label="緊急連絡先" value={form.emergency_contact} onChange={(e) => update('emergency_contact', e.target.value)} />
                </div>
                <Textarea label="契約情報" value={form.contract_info} onChange={(e) => update('contract_info', e.target.value)} rows={3} />
                <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">有効</span>
                  <Switch checked={form.is_active} onCheckedChange={(v) => update('is_active', v)} />
                </div>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading} className="w-full">{loading ? '保存中...' : '変更を保存'}</Button>
              <Link href={`/stores/${id}`}>
                <Button type="button" variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> キャンセル</Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
