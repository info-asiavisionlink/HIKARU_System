'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClientRecord } from '@/services/clients.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
} from '@hikaru/ui'
import { ArrowLeft } from 'lucide-react'

export default function NewClientPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({
    name: '', code: '', email: '', phone: '', address: '', contact_name: '', notes: '',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('顧客名を入力してください'); return }
    setLoading(true)

    const { error } = await createClientRecord({
      name:         form.name.trim(),
      code:         form.code.trim()         || null,
      email:        form.email.trim()        || null,
      phone:        form.phone.trim()        || null,
      address:      form.address.trim()      || null,
      contact_name: form.contact_name.trim() || null,
      notes:        form.notes.trim()        || null,
    })

    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('顧客を作成しました')
      router.push('/clients')
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="新規顧客"
        breadcrumb={<Breadcrumb items={[{ label: '顧客管理', href: '/clients' }, { label: '新規顧客' }]} />}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="顧客名 *" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="株式会社○○" required />
                  <Input label="顧客コード" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="CLI-001" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="担当者名" value={form.contact_name} onChange={(e) => update('contact_name', e.target.value)} placeholder="山田 太郎" />
                  <Input label="電話番号" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="03-xxxx-xxxx" />
                </div>
                <Input label="メールアドレス" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="info@example.com" />
                <Input label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="東京都渋谷区..." />
                <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="特記事項があれば入力" rows={3} />
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '保存中...' : '顧客を作成'}
            </Button>
            <Link href="/clients">
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
