'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  getPartner,
  updatePartner,
  changePartnerPassword,
  deletePartner,
  partnerStatusLabel,
  partnerStatusOptions,
  type PartnerDetail,
  type PartnerStatus,
} from '@/services/partners.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import { ArrowLeft, Edit2, Save, Key, Trash2, FolderOpen, Building2, Lock } from 'lucide-react'

const statusVariant: Record<PartnerStatus, string> = {
  active:     'success',
  suspended:  'warning',
  terminated: 'secondary',
  deleted:    'secondary',
}

export default function PartnerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [partner, setPartner]   = React.useState<PartnerDetail | null>(null)
  const [loading, setLoading]   = React.useState(true)
  const [editing, setEditing]   = React.useState(false)
  const [saving, setSaving]     = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)
  const [showPw, setShowPw]     = React.useState(false)
  const [newPw, setNewPw]       = React.useState('')
  const [pwSaving, setPwSaving] = React.useState(false)
  const [form, setForm] = React.useState<Partial<PartnerDetail>>({})

  React.useEffect(() => { loadData() }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const data = await getPartner(id)
    setPartner(data)
    if (data) {
      setForm({
        company_name:        data.company_name,
        company_name_kana:   data.company_name_kana,
        contact_person_name: data.contact_person_name,
        contact_person_kana: data.contact_person_kana,
        phone:               data.phone,
        email:               data.email,
        address:             data.address,
        contract_start_date: data.contract_start_date,
        contract_end_date:   data.contract_end_date,
        service_areas:       data.service_areas,
        service_types:       data.service_types,
        qualifications:      data.qualifications,
        notes:               data.notes,
        status:              data.status,
      })
    }
    setLoading(false)
  }

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  function splitLines(value: string): string[] {
    return value.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean)
  }

  async function handleSave() {
    if (!form.company_name?.trim()) { toast.error('会社名を入力してください'); return }
    setSaving(true)
    const { error } = await updatePartner(id, form as any)
    if (error) {
      toast.error('更新に失敗しました: ' + error)
    } else {
      toast.success('更新しました')
      setEditing(false)
      await loadData()
    }
    setSaving(false)
  }

  async function handleDelete() {
    const { error } = await deletePartner(id)
    if (error) {
      toast.error('削除に失敗しました: ' + error)
    } else {
      toast.success('協力業者を削除しました')
      router.push('/partners')
    }
  }

  async function handlePasswordChange() {
    if (newPw.length < 8) { toast.error('8文字以上で入力してください'); return }
    setPwSaving(true)
    const { error } = await changePartnerPassword(id, newPw)
    if (error) {
      toast.error('変更に失敗しました: ' + error)
    } else {
      toast.success('パスワードを変更しました')
      setShowPw(false)
      setNewPw('')
    }
    setPwSaving(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!partner) {
    return <div className="text-center py-20 text-[var(--color-muted-foreground)]">協力業者が見つかりません</div>
  }

  return (
    <div>
      <PageHeader
        title={partner.company_name}
        description={partner.contact_person_name ?? undefined}
        breadcrumb={
          <Breadcrumb items={[{ label: '協力業者管理', href: '/partners' }, { label: partner.company_name }]} />
        }
        actions={
          <div className="flex gap-2">
            {partner.auth_user_id && (
              <Button variant="outline" size="sm" onClick={() => setShowPw(true)}>
                <Key className="h-4 w-4" /> パスワード変更
              </Button>
            )}
            {editing ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(false)}>キャンセル</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" /> {saving ? '保存中...' : '保存'}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit2 className="h-4 w-4" /> 編集
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 基本情報
              </h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="会社名 *" value={form.company_name ?? ''} onChange={(e) => update('company_name', e.target.value)} />
                    <Input label="会社名カナ" value={form.company_name_kana ?? ''} onChange={(e) => update('company_name_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="担当者名" value={form.contact_person_name ?? ''} onChange={(e) => update('contact_person_name', e.target.value)} />
                    <Input label="担当者カナ" value={form.contact_person_kana ?? ''} onChange={(e) => update('contact_person_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="電話番号" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
                    <Input label="メール" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <Textarea label="住所" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} rows={2} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['会社名カナ',  partner.company_name_kana ?? '—'],
                    ['担当者',      partner.contact_person_name ?? '—'],
                    ['担当者カナ',  partner.contact_person_kana ?? '—'],
                    ['電話番号',    partner.phone ?? '—'],
                    ['メール',      partner.email ?? '—'],
                    ['住所',        partner.address ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
                      <dd className="font-medium mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">契約情報</h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">ステータス</label>
                      <Select value={form.status ?? 'active'} onValueChange={(v) => update('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {partnerStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="契約開始日" type="date" value={form.contract_start_date ?? ''} onChange={(e) => update('contract_start_date', e.target.value)} />
                    <Input label="契約終了日" type="date" value={form.contract_end_date ?? ''} onChange={(e) => update('contract_end_date', e.target.value)} />
                  </div>
                  <Textarea label="対応可能エリア（改行区切り）" value={(form.service_areas ?? []).join('\n')} onChange={(e) => update('service_areas', splitLines(e.target.value))} rows={3} />
                  <Textarea label="対応可能業務（改行区切り）" value={(form.service_types ?? []).join('\n')} onChange={(e) => update('service_types', splitLines(e.target.value))} rows={3} />
                  <Textarea label="保有資格（改行区切り）" value={(form.qualifications ?? []).join('\n')} onChange={(e) => update('qualifications', splitLines(e.target.value))} rows={3} />
                  <Textarea label="備考" value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['契約開始日', partner.contract_start_date ? new Date(partner.contract_start_date).toLocaleDateString('ja-JP') : '—'],
                    ['契約終了日', partner.contract_end_date   ? new Date(partner.contract_end_date).toLocaleDateString('ja-JP')   : '—'],
                    ['対応エリア', partner.service_areas.length ? partner.service_areas.join('、') : '—'],
                    ['対応業務',   partner.service_types.length ? partner.service_types.join('、') : '—'],
                    ['保有資格',   partner.qualifications.length ? partner.qualifications.join('、') : '—'],
                    ['備考',       partner.notes ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
                      <dd className="font-medium mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> 担当案件
              </h2>
              {partner.assignments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">担当案件なし</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {partner.assignments.map((a) => (
                    <li key={a.project_id} className="py-2 flex items-center justify-between">
                      <p className="text-sm font-medium">{a.projects?.name ?? '—'}</p>
                      <Link href={`/projects/${a.project_id}`}>
                        <Button variant="ghost" size="sm">詳細</Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4" /> ステータス・ログイン
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">ステータス</span>
                  <Badge variant={statusVariant[partner.status] as any}>{partnerStatusLabel[partner.status]}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">ログインID</span>
                  <span className="font-medium">{partner.loginEmail ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">登録日</span>
                  <span>{new Date(partner.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/partners">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> 一覧へ戻る
            </Button>
          </Link>
        </div>
      </div>

      <Dialog open={showPw} onOpenChange={setShowPw}>
        <DialogContent>
          <DialogHeader><DialogTitle>パスワードを変更</DialogTitle></DialogHeader>
          <DialogBody>
            <Input label="新しいパスワード（8文字以上）" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="新しいパスワード" autoFocus />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPw(false); setNewPw('') }}>キャンセル</Button>
            <Button onClick={handlePasswordChange} disabled={pwSaving}>{pwSaving ? '変更中...' : '変更する'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>協力業者を削除しますか？</DialogTitle></DialogHeader>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <span className="font-semibold text-[var(--color-foreground)]">{partner.company_name}</span> を削除します。<br />
            ログインアカウントと全データが完全に削除されます。この操作は取り消せません。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDelete}>削除する</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
