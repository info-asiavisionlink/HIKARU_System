'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getClient, updateClient } from '@/services/clients.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Breadcrumb, Switch,
} from '@hikaru/ui'
import { Pencil, Store, Save, X } from 'lucide-react'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', code: '', email: '', phone: '', address: '', contact_name: '', notes: '', is_active: true,
  })

  React.useEffect(() => {
    getClient(id).then(({ data }) => {
      setClient(data)
      if (data) {
        setForm({
          name:         data.name ?? '',
          code:         data.code ?? '',
          email:        data.email ?? '',
          phone:        data.phone ?? '',
          address:      data.address ?? '',
          contact_name: data.contact_name ?? '',
          notes:        data.notes ?? '',
          is_active:    data.is_active ?? true,
        })
      }
      setLoading(false)
    })
  }, [id])

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('顧客名を入力してください'); return }
    setSaving(true)
    const { error } = await updateClient(id, {
      name:         form.name.trim(),
      code:         form.code.trim()         || null,
      email:        form.email.trim()        || null,
      phone:        form.phone.trim()        || null,
      address:      form.address.trim()      || null,
      contact_name: form.contact_name.trim() || null,
      notes:        form.notes.trim()        || null,
      is_active:    form.is_active,
    })
    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('顧客情報を更新しました')
      const { data } = await getClient(id)
      setClient(data)
      setEditing(false)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-muted-foreground)]">顧客が見つかりませんでした</p>
        <Link href="/clients"><Button variant="outline" className="mt-4">一覧に戻る</Button></Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={client.name}
        breadcrumb={<Breadcrumb items={[{ label: '顧客管理', href: '/clients' }, { label: client.name }]} />}
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}><X className="h-4 w-4" /> キャンセル</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> 編集</Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">顧客情報</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="顧客名 *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                    <Input label="顧客コード" value={form.code} onChange={(e) => update('code', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="担当者名" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} />
                    <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
                  </div>
                  <Input label="メール" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
                  <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} />
                  <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">有効</span>
                    <Switch checked={form.is_active} onCheckedChange={(v) => update('is_active', v)} />
                  </div>
                </div>
              ) : (
                <dl>
                  <InfoRow label="顧客名" value={client.name} />
                  <InfoRow label="顧客コード" value={client.code} />
                  <InfoRow label="担当者名" value={client.contact_name} />
                  <InfoRow label="電話番号" value={client.phone} />
                  <InfoRow label="メールアドレス" value={client.email} />
                  <InfoRow label="住所" value={client.address} />
                  <InfoRow label="備考" value={client.notes} />
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                <Badge variant={client.is_active ? 'success' : 'secondary'}>
                  {client.is_active ? '有効' : '無効'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                <span className="text-sm">{new Date(client.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </CardContent>
          </Card>

          {client.stores && client.stores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Store className="h-4 w-4" /> 店舗 ({client.stores.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {client.stores.map((store: any) => (
                  <Link
                    key={store.id}
                    href={`/stores/${store.id}`}
                    className="flex items-center justify-between rounded-[var(--radius)] p-2 hover:bg-[var(--color-muted)] transition-colors"
                  >
                    <span className="text-sm">{store.name}</span>
                    <Badge variant={store.is_active ? 'success' : 'secondary'} size="sm">
                      {store.is_active ? '有効' : '無効'}
                    </Badge>
                  </Link>
                ))}
                <Link href={`/stores/new?client_id=${id}`} className="mt-2 block">
                  <Button variant="outline" size="sm" className="w-full">店舗を追加</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
