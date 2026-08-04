'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createPartner } from '@/services/partners.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast, Breadcrumb,
} from '@hikaru/ui'
import { ArrowLeft, Lock, Building2 } from 'lucide-react'

export default function NewPartnerPage() {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [hasLogin, setHasLogin] = React.useState(true)

  const [form, setForm] = React.useState({
    company_name: '',
    company_name_kana: '',
    contact_person_name: '',
    contact_person_kana: '',
    phone: '',
    email: '',
    address: '',
    contract_start_date: '',
    contract_end_date: '',
    service_areas: '',
    service_types: '',
    qualifications: '',
    notes: '',
    loginEmail: '',
    loginPassword: '',
  })

  function update(key: string, value: string) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function splitLines(value: string): string[] {
    return value.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.company_name.trim()) { toast.error('会社名を入力してください'); return }
    if (hasLogin) {
      if (!form.loginEmail.trim()) { toast.error('ログインIDを入力してください'); return }
      if (form.loginPassword.length < 8) { toast.error('パスワードは8文字以上で入力してください'); return }
    }

    setLoading(true)
    const { error } = await createPartner({
      company_name:        form.company_name.trim(),
      company_name_kana:   form.company_name_kana.trim()    || null,
      contact_person_name: form.contact_person_name.trim()  || null,
      contact_person_kana: form.contact_person_kana.trim()  || null,
      phone:               form.phone.trim()                || null,
      email:               form.email.trim()                || null,
      address:             form.address.trim()              || null,
      contract_start_date: form.contract_start_date         || null,
      contract_end_date:   form.contract_end_date           || null,
      service_areas:       splitLines(form.service_areas),
      service_types:       splitLines(form.service_types),
      qualifications:      splitLines(form.qualifications),
      notes:               form.notes.trim()                || null,
      ...(hasLogin ? {
        loginEmail:    form.loginEmail.trim(),
        loginPassword: form.loginPassword,
      } : {}),
    })

    if (error) {
      toast.error('登録に失敗しました: ' + error)
    } else {
      toast.success('協力業者を登録しました')
      router.push('/partners')
    }
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="協力業者を登録"
        breadcrumb={
          <Breadcrumb items={[{ label: '協力業者管理', href: '/partners' }, { label: '新規登録' }]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> 基本情報
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="会社名 *" value={form.company_name} onChange={(e) => update('company_name', e.target.value)} placeholder="株式会社〇〇" required />
                  <Input label="会社名カナ" value={form.company_name_kana} onChange={(e) => update('company_name_kana', e.target.value)} placeholder="カブシキカイシャ〇〇" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="担当者名" value={form.contact_person_name} onChange={(e) => update('contact_person_name', e.target.value)} placeholder="田中 一郎" />
                  <Input label="担当者カナ" value={form.contact_person_kana} onChange={(e) => update('contact_person_kana', e.target.value)} placeholder="タナカ イチロウ" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="電話番号" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="03-1234-5678" />
                  <Input label="メールアドレス" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="info@partner.co.jp" />
                </div>
                <Textarea label="住所" value={form.address} onChange={(e) => update('address', e.target.value)} rows={2} />
              </CardContent>
            </Card>

            {/* 契約情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">契約情報</h2>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="契約開始日" type="date" value={form.contract_start_date} onChange={(e) => update('contract_start_date', e.target.value)} />
                  <Input label="契約終了日" type="date" value={form.contract_end_date} onChange={(e) => update('contract_end_date', e.target.value)} />
                </div>
                <Textarea label="対応可能エリア（改行区切り）" value={form.service_areas} onChange={(e) => update('service_areas', e.target.value)} placeholder="東京都&#10;神奈川県" rows={3} />
                <Textarea label="対応可能業務（改行区切り）" value={form.service_types} onChange={(e) => update('service_types', e.target.value)} placeholder="ビル清掃&#10;エアコンクリーニング" rows={3} />
                <Textarea label="保有資格（改行区切り）" value={form.qualifications} onChange={(e) => update('qualifications', e.target.value)} rows={3} />
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
                    <Input
                      label="ログインID（メールアドレス） *"
                      type="email"
                      value={form.loginEmail}
                      onChange={(e) => update('loginEmail', e.target.value)}
                      placeholder="login@partner.co.jp"
                    />
                    <Input
                      label="パスワード *"
                      type="password"
                      value={form.loginPassword}
                      onChange={(e) => update('loginPassword', e.target.value)}
                      placeholder="8文字以上"
                    />
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      協力業者は HIKARU-System のみログインできます。HIKARU-CONSOLE にはアクセスできません。
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

          <div className="flex flex-col gap-2 h-fit">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? '登録中...' : '協力業者を登録'}
            </Button>
            <Link href="/partners">
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
