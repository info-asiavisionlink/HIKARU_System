'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { getProject, updateProject } from '@/services/projects.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, toast,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
  Breadcrumb, Skeleton,
} from '@hikaru/ui'
import { ArrowLeft } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'active',    label: '稼働中' },
  { value: 'paused',    label: '停止中' },
  { value: 'completed', label: '完了' },
  { value: 'cancelled', label: 'キャンセル' },
]

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [fetching, setFetching] = React.useState(true)
  const [form, setForm] = React.useState({
    name: '',
    code: '',
    status: 'active',
    start_date: '',
    end_date: '',
    location_name: '',
    phone: '',
    emergency_contact: '',
    business_hours: '',
    contract_info: '',
    notes: '',
  })

  React.useEffect(() => {
    getProject(id).then(({ data }) => {
      if (data) {
        setForm({
          name:              data.name ?? '',
          code:              data.code ?? '',
          status:            data.status ?? 'active',
          start_date:        data.start_date ?? '',
          end_date:          data.end_date ?? '',
          location_name:     data.location_name ?? '',
          phone:             data.phone ?? '',
          emergency_contact: data.emergency_contact ?? '',
          business_hours:    data.business_hours ?? '',
          contract_info:     data.contract_info ?? '',
          notes:             data.notes ?? '',
        })
      }
      setFetching(false)
    })
  }, [id])

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('案件名を入力してください'); return }

    setLoading(true)
    const { error } = await updateProject(id, {
      name:              form.name.trim(),
      code:              form.code.trim()              || null,
      status:            form.status as any,
      start_date:        form.start_date               || null,
      end_date:          form.end_date                 || null,
      location_name:     form.location_name.trim()     || null,
      phone:             form.phone.trim()             || null,
      emergency_contact: form.emergency_contact.trim() || null,
      business_hours:    form.business_hours.trim()    || null,
      contract_info:     form.contract_info.trim()     || null,
      notes:             form.notes.trim()             || null,
    })

    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success('案件を更新しました')
      router.push(`/projects/${id}`)
    }
    setLoading(false)
  }

  if (fetching) {
    return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  }

  return (
    <div>
      <PageHeader
        title="案件を編集"
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: form.name, href: `/projects/${id}` },
            { label: '編集' },
          ]} />
        }
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">

            {/* 基本情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">基本情報</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="案件名 *" value={form.name} onChange={(e) => update('name', e.target.value)} required />
                  <Input label="案件コード" value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="PRJ-001" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="開始日" type="date" value={form.start_date} onChange={(e) => update('start_date', e.target.value)} />
                  <Input label="終了日" type="date" value={form.end_date}   onChange={(e) => update('end_date', e.target.value)} />
                </div>
              </CardContent>
            </Card>

            {/* 作業場所 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業場所</h2>
                <Input
                  label="作業場所名"
                  value={form.location_name}
                  onChange={(e) => update('location_name', e.target.value)}
                  placeholder="例: ○○マンション / ○○病院 / ○○工場"
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input
                    label="電話番号"
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="現場の電話番号"
                  />
                  <Input
                    label="緊急連絡先"
                    value={form.emergency_contact}
                    onChange={(e) => update('emergency_contact', e.target.value)}
                    placeholder="緊急時の連絡先"
                  />
                </div>
                <Input
                  label="作業可能時間帯"
                  value={form.business_hours}
                  onChange={(e) => update('business_hours', e.target.value)}
                  placeholder="例: 平日 9:00〜18:00"
                />
              </CardContent>
            </Card>

            {/* 詳細情報 */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">詳細情報</h2>
                <Textarea label="契約内容" value={form.contract_info} onChange={(e) => update('contract_info', e.target.value)} rows={4} />
                <Textarea label="注意事項" value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={3} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">ステータス</h2>
                <Select value={form.status} onValueChange={(v) => update('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? '保存中...' : '変更を保存'}
              </Button>
              <Link href={`/projects/${id}`}>
                <Button type="button" variant="outline" className="w-full">
                  <ArrowLeft className="h-4 w-4" /> キャンセル
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
