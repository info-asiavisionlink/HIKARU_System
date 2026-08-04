'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { inviteUser, type UserRole } from '@/services/users.service'
import {
  PageHeader, Button, Input, Card, CardContent, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { ArrowLeft, Mail } from 'lucide-react'

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'worker', label: '作業者',   desc: '現場での作業記録・マニュアル参照' },
  { value: 'admin',  label: '管理者',   desc: '管理コンソールへのアクセス' },
  { value: 'client', label: 'オーナー', desc: '自施設の清掃品質確認・報告書閲覧' },
]

export default function InviteUserPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ email: '', name: '', role: 'worker' as UserRole })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim()) { toast.error('メールアドレスを入力してください'); return }
    if (!form.name.trim())  { toast.error('名前を入力してください'); return }

    setLoading(true)
    const { error } = await inviteUser(form.email.trim(), form.name.trim(), form.role)
    if (error) {
      toast.error('招待に失敗しました: ' + (error as any)?.message)
    } else {
      toast.success('招待メールを送信しました')
      router.push('/workers')
    }
    setLoading(false)
  }

  const selectedRole = ROLE_OPTIONS.find((r) => r.value === form.role)

  return (
    <div>
      <PageHeader
        title="ユーザーを招待"
        breadcrumb={<Breadcrumb items={[{ label: 'ユーザー管理', href: '/workers' }, { label: 'ユーザーを招待' }]} />}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">招待情報</h2>
                <Input
                  label="メールアドレス *"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="example@company.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  required
                />
                <Input
                  label="名前 *"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="山田 太郎"
                  required
                />
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">権限 *</label>
                  <Select value={form.role} onValueChange={(v) => update('role', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedRole && (
                    <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">{selectedRole.desc}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="rounded-[var(--radius-lg)] border border-[var(--color-info)]/30 bg-[var(--color-info-muted)] p-4">
              <p className="text-sm text-[var(--color-info-foreground)]">
                招待メールが送信されます。受信者はメール内のリンクからパスワードを設定してログインできます。
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '送信中...' : '招待メールを送信'}
            </Button>
            <Link href="/workers">
              <Button type="button" variant="outline" className="w-full"><ArrowLeft className="h-4 w-4" /> キャンセル</Button>
            </Link>
          </div>
        </div>
      </form>
    </div>
  )
}
