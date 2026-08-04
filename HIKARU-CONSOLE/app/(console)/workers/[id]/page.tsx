'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getUser, updateUser, roleLabel, type UserRole } from '@/services/users.service'
import {
  PageHeader, Button, Input, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Breadcrumb, Avatar, AvatarFallback,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { Pencil, Save, X } from 'lucide-react'

const roleVariant: Record<UserRole, any> = {
  admin:  'default',
  worker: 'success',
  client: 'info',
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [user, setUser] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', role: 'worker' as UserRole, phone: '' })

  React.useEffect(() => {
    getUser(id).then(({ data }) => {
      setUser(data)
      if (data) setForm({ name: data.name, role: data.role, phone: data.phone ?? '' })
      setLoading(false)
    })
  }, [id])

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('名前を入力してください'); return }
    setSaving(true)
    const { error } = await updateUser(id, {
      name:  form.name.trim(),
      role:  form.role,
      phone: form.phone.trim() || null,
    })
    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('ユーザー情報を更新しました')
      const { data } = await getUser(id)
      setUser(data)
      setEditing(false)
    }
    setSaving(false)
  }

  if (loading) return (
    <div>
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!user) return (
    <div className="text-center py-16">
      <p className="text-[var(--color-muted-foreground)]">ユーザーが見つかりませんでした</p>
      <Link href="/workers"><Button variant="outline" className="mt-4">一覧に戻る</Button></Link>
    </div>
  )

  return (
    <div>
      <PageHeader
        title={user.name}
        breadcrumb={<Breadcrumb items={[{ label: 'ユーザー管理', href: '/workers' }, { label: user.name }]} />}
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">{user.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-lg font-semibold">{user.name}</h2>
                  <p className="text-sm text-[var(--color-muted-foreground)]">{user.email}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-4">
                  <Input label="名前 *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                  <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="090-xxxx-xxxx" />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">権限</label>
                    <Select value={form.role} onValueChange={(v) => update('role', v as UserRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">管理者</SelectItem>
                        <SelectItem value="worker">作業者</SelectItem>
                        <SelectItem value="client">オーナー</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <dl>
                  <InfoRow label="名前" value={user.name} />
                  <InfoRow label="メール" value={user.email} />
                  <InfoRow label="電話番号" value={user.phone} />
                  <InfoRow
                    label="最終ログイン"
                    value={user.last_login_at ? new Date(user.last_login_at).toLocaleString('ja-JP') : null}
                  />
                  <InfoRow
                    label="登録日"
                    value={new Date(user.created_at).toLocaleDateString('ja-JP')}
                  />
                </dl>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">権限</span>
                <Badge variant={roleVariant[user.role as UserRole]}>{roleLabel[user.role as UserRole]}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
