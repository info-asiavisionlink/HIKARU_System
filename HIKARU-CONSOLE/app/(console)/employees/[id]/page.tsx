'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  getEmployee,
  updateEmployee,
  changeEmployeePassword,
  deleteEmployee,
  employeeStatusLabel,
  employeeStatusOptions,
  type EmployeeDetail,
  type EmployeeStatus,
} from '@/services/employees.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, Badge, Skeleton, toast, Breadcrumb,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import { ArrowLeft, Edit2, Save, Key, Trash2, FolderOpen, Lock, User } from 'lucide-react'

const statusVariant: Record<EmployeeStatus, string> = {
  active:   'success',
  on_leave: 'warning',
  resigned: 'secondary',
  suspended: 'destructive',
  deleted:  'secondary',
}

const ROLE_OPTIONS = [
  { value: 'worker', label: '従業員（HIKARU-System のみ）' },
  { value: 'admin',  label: '管理者（HIKARU-CONSOLE アクセス可）' },
]

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [emp, setEmp] = React.useState<EmployeeDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [saving, setSaving]   = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)
  const [showPw, setShowPw]   = React.useState(false)
  const [newPw, setNewPw]     = React.useState('')
  const [pwSaving, setPwSaving] = React.useState(false)
  const [form, setForm] = React.useState<Partial<EmployeeDetail>>({})

  React.useEffect(() => {
    loadData()
  }, [id]) // eslint-disable-line

  async function loadData() {
    setLoading(true)
    const data = await getEmployee(id)
    setEmp(data)
    if (data) {
      setForm({
        name:              data.name,
        name_kana:         data.name_kana,
        birth_date:        data.birth_date,
        gender:            data.gender,
        phone:             data.phone,
        email:             data.email,
        address:           data.address,
        emergency_contact: data.emergency_contact,
        hire_date:         data.hire_date,
        department:        data.department,
        position:          data.position,
        qualifications:    data.qualifications,
        notes:             data.notes,
        status:            data.status,
      })
    }
    setLoading(false)
  }

  function update(key: string, value: any) {
    setForm((p) => ({ ...p, [key]: value }))
  }

  async function handleSave() {
    if (!form.name?.trim()) { toast.error('氏名を入力してください'); return }
    setSaving(true)
    const { error } = await updateEmployee(id, form as any)
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
    const { error } = await deleteEmployee(id)
    if (error) {
      toast.error('削除に失敗しました: ' + error)
    } else {
      toast.success('従業員を削除しました')
      router.push('/employees')
    }
  }

  async function handlePasswordChange() {
    if (newPw.length < 8) { toast.error('8文字以上で入力してください'); return }
    setPwSaving(true)
    const { error } = await changeEmployeePassword(id, newPw)
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

  if (!emp) {
    return (
      <div className="text-center py-20 text-[var(--color-muted-foreground)]">
        従業員が見つかりません
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={emp.name}
        description={emp.employee_number ?? undefined}
        breadcrumb={
          <Breadcrumb items={[{ label: '従業員管理', href: '/employees' }, { label: emp.name }]} />
        }
        actions={
          <div className="flex gap-2">
            {emp.auth_user_id && (
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
          {/* 基本情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <User className="h-4 w-4" /> 基本情報
              </h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="氏名 *" value={form.name ?? ''} onChange={(e) => update('name', e.target.value)} />
                    <Input label="フリガナ" value={form.name_kana ?? ''} onChange={(e) => update('name_kana', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="生年月日" type="date" value={form.birth_date ?? ''} onChange={(e) => update('birth_date', e.target.value)} />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">性別</label>
                      <Select value={form.gender ?? ''} onValueChange={(v) => update('gender', v || null)}>
                        <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">—</SelectItem>
                          <SelectItem value="male">男性</SelectItem>
                          <SelectItem value="female">女性</SelectItem>
                          <SelectItem value="other">その他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="電話番号" type="tel" value={form.phone ?? ''} onChange={(e) => update('phone', e.target.value)} />
                    <Input label="メールアドレス" type="email" value={form.email ?? ''} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <Textarea label="住所" value={form.address ?? ''} onChange={(e) => update('address', e.target.value)} rows={2} />
                  <Input label="緊急連絡先" value={form.emergency_contact ?? ''} onChange={(e) => update('emergency_contact', e.target.value)} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['社員番号',     emp.employee_number ?? '—'],
                    ['フリガナ',     emp.name_kana ?? '—'],
                    ['生年月日',     emp.birth_date ? new Date(emp.birth_date).toLocaleDateString('ja-JP') : '—'],
                    ['性別',         emp.gender === 'male' ? '男性' : emp.gender === 'female' ? '女性' : emp.gender === 'other' ? 'その他' : '—'],
                    ['電話番号',     emp.phone ?? '—'],
                    ['メール',       emp.email ?? '—'],
                    ['住所',         emp.address ?? '—'],
                    ['緊急連絡先',   emp.emergency_contact ?? '—'],
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

          {/* 雇用情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">雇用情報</h2>
              {editing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="入社日" type="date" value={form.hire_date ?? ''} onChange={(e) => update('hire_date', e.target.value)} />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">ステータス</label>
                      <Select value={form.status ?? 'active'} onValueChange={(v) => update('status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {employeeStatusOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Input label="所属部署" value={form.department ?? ''} onChange={(e) => update('department', e.target.value)} />
                    <Input label="役職" value={form.position ?? ''} onChange={(e) => update('position', e.target.value)} />
                  </div>
                  <Textarea
                    label="資格（改行・カンマ区切り）"
                    value={(form.qualifications ?? []).join('\n')}
                    onChange={(e) => update('qualifications', e.target.value.split(/[、,\n]/).map((s) => s.trim()).filter(Boolean))}
                    rows={3}
                  />
                  <Textarea label="備考" value={form.notes ?? ''} onChange={(e) => update('notes', e.target.value)} rows={3} />
                </>
              ) : (
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {[
                    ['入社日',   emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('ja-JP') : '—'],
                    ['所属部署', emp.department ?? '—'],
                    ['役職',     emp.position ?? '—'],
                    ['資格',     emp.qualifications.length ? emp.qualifications.join('、') : '—'],
                    ['備考',     emp.notes ?? '—'],
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

          {/* 担当案件 */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> 担当案件
              </h2>
              {emp.assignments.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">担当案件なし</p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {emp.assignments.map((a) => (
                    <li key={a.project_id} className="py-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.projects?.name ?? '—'}</p>
                        {a.projects?.code && (
                          <p className="text-xs text-[var(--color-muted-foreground)]">{a.projects.code}</p>
                        )}
                      </div>
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

        {/* サイドバー */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Lock className="h-4 w-4" /> ステータス・ログイン
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">ステータス</span>
                  <Badge variant={statusVariant[emp.status] as any}>{employeeStatusLabel[emp.status]}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">ログインID</span>
                  <span className="font-medium">{emp.loginEmail ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--color-muted-foreground)]">登録日</span>
                  <span>{new Date(emp.created_at).toLocaleDateString('ja-JP')}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Link href="/employees">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="h-4 w-4" /> 一覧へ戻る
            </Button>
          </Link>
        </div>
      </div>

      {/* パスワード変更ダイアログ */}
      <Dialog open={showPw} onOpenChange={setShowPw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードを変更</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-4">
              ログインID: <span className="font-mono font-bold text-[var(--color-foreground)]">{emp.employee_number}</span>
            </p>
            <Input
              label="新しいパスワード（8文字以上）"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="新しいパスワード"
              autoFocus
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPw(false); setNewPw('') }}>キャンセル</Button>
            <Button onClick={handlePasswordChange} disabled={pwSaving}>
              {pwSaving ? '変更中...' : '変更する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>従業員を削除しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            <span className="font-semibold text-[var(--color-foreground)]">{emp.name}</span> を削除します。<br />
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
