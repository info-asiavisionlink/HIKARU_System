'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createEmployee } from '@/services/employees.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { ArrowLeft, Lock, User } from 'lucide-react'

const ROLE_OPTIONS = [
  { value: 'worker', label: '従業員（HIKARU-System のみ）' },
  { value: 'admin',  label: '管理者（HIKARU-CONSOLE アクセス可）' },
]

export default function NewEmployeePage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [hasLogin, setHasLogin] = React.useState(true)

  const [form, setForm] = React.useState({
    name: '',
    name_kana: '',
    birth_date: '',
    gender: '' as 'male' | 'female' | 'other' | '',
    phone: '',
    email: '',
    address: '',
    emergency_contact: '',
    hire_date: '',
    department: '',
    position: '',
    qualifications: '',
    notes: '',
    loginPassword: '',
    role: 'worker' as 'admin' | 'worker',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('氏名を入力してください'); return }
    if (hasLogin) {
      if (form.loginPassword.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }
    }

    setLoading(true)
    const { error } = await createEmployee({
      name:               form.name.trim(),
      name_kana:          form.name_kana.trim()          || null,
      birth_date:         form.birth_date                || null,
      gender:             (form.gender as any)           || null,
      phone:              form.phone.trim()              || null,
      email:              form.email.trim()              || null,
      address:            form.address.trim()            || null,
      emergency_contact:  form.emergency_contact.trim()  || null,
      hire_date:          form.hire_date                 || null,
      department:         form.department.trim()         || null,
      position:           form.position.trim()           || null,
      qualifications:     form.qualifications.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean),
      notes:              form.notes.trim()              || null,
      ...(hasLogin ? {
        loginPassword: form.loginPassword,
        role:          form.role,
      } : {}),
    })

    if (error) {
      toast.error('登録に失敗しました: ' + error)
    } else {
      toast.success('従業員を登録しました')
      router.push('/employees')
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="従業員を登録"
        breadcrumb={
          <Breadcrumb items={[{ label: '従業員管理', href: '/employees' }, { label: '新規登録' }]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <User className="h-4 w-4" /> 基本情報
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="氏名 *" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="山田 太郎" required />
                  <Input label="フリガナ" value={form.name_kana} onChange={(e) => update('name_kana', e.target.value)} placeholder="ヤマダ タロウ" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="生年月日" type="date" value={form.birth_date} onChange={(e) => update('birth_date', e.target.value)} />
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">性別</label>
                    <Select value={form.gender} onValueChange={(v) => update('gender', v)}>
                      <SelectTrigger><SelectValue placeholder="選択してください" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">男性</SelectItem>
                        <SelectItem value="female">女性</SelectItem>
                        <SelectItem value="other">その他</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="電話番号" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="090-1234-5678" />
                  <Input label="メールアドレス" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="taro@example.com" />
                </div>
                <Textarea label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="東京都渋谷区..." rows={2} />
                <Input label="緊急連絡先" value={form.emergency_contact} onChange={(e) => update('emergency_contact', e.target.value)} placeholder="氏名 / 続柄 / 電話番号" />
              </CardContent>
            </Card>

            {/* 雇用情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">雇用情報</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="入社日" type="date" value={form.hire_date} onChange={(e) => update('hire_date', e.target.value)} />
                  <div />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="所属部署" value={form.department} onChange={(e) => update('department', e.target.value)} placeholder="清掃部" />
                  <Input label="役職" value={form.position} onChange={(e) => update('position', e.target.value)} placeholder="チーフ" />
                </div>
                <Textarea label="資格（改行・カンマ区切り）" value={form.qualifications} onChange={(e) => update('qualifications', e.target.value)} placeholder="清掃作業主任者&#10;ビルクリーニング技能士" rows={3} />
                <Textarea label="備考" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>

            {/* ログイン情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                    <Lock className="h-4 w-4" /> ログイン情報
                  </h2>
                  <button
                    type="button"
                    onClick={() => setHasLogin((v) => !v)}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    {hasLogin ? 'ログイン不要に変更' : 'ログインを設定する'}
                  </button>
                </div>

                {hasLogin ? (
                  <>
                    <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3 text-sm">
                      <p className="font-medium text-[var(--color-foreground)]">ログインIDについて</p>
                      <p className="mt-1 text-[var(--color-muted-foreground)]">
                        登録後に自動発行される <span className="font-mono font-bold">社員番号（例: EMP-0001）</span> がそのままログインIDになります。
                        メールアドレスの入力は不要です。
                      </p>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">権限 *</label>
                      <Select value={form.role} onValueChange={(v) => update('role', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      label="初期パスワード *"
                      type="password"
                      value={form.loginPassword}
                      onChange={(e) => update('loginPassword', e.target.value)}
                      placeholder="8文字以上"
                    />
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      登録後、管理者がいつでもパスワードを変更できます。
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    ログインアカウントなし（情報管理のみ）
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* サイドボタン */}
          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登録中...' : '従業員を登録'}
            </Button>
            <Link href="/employees">
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
