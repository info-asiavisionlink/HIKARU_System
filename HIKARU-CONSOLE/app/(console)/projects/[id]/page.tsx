'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { getProject, deleteProject } from '@/services/projects.service'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle,
  StatusBadge, Badge, Skeleton, Breadcrumb, toast,
} from '@hikaru/ui'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import { Pencil, Trash2, BookOpen, MapPin, User, Calendar, FileText, AlertTriangle } from 'lucide-react'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project, setProject] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  React.useEffect(() => {
    getProject(id).then(({ data }) => {
      setProject(data)
      setLoading(false)
    })
  }, [id])

  async function handleDelete() {
    const { error } = await deleteProject(id)
    if (error) {
      toast.error('削除に失敗しました')
    } else {
      toast.success('案件を削除しました')
      router.push('/projects')
    }
  }

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-32 mb-6" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><Skeleton className="h-64 w-full" /></div>
          <div><Skeleton className="h-40 w-full" /></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-[var(--color-muted-foreground)]">案件が見つかりませんでした</p>
        <Link href="/projects"><Button variant="outline" className="mt-4">一覧に戻る</Button></Link>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: project.name },
          ]} />
        }
        actions={
          <div className="flex gap-2">
            <Link href={`/projects/${id}/manuals`}>
              <Button variant="outline"><BookOpen className="h-4 w-4" /> マニュアル</Button>
            </Link>
            <Link href={`/projects/${id}/edit`}>
              <Button variant="outline"><Pencil className="h-4 w-4" /> 編集</Button>
            </Link>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> 削除
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 基本情報 */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">基本情報</CardTitle>
            </CardHeader>
            <CardContent>
              <dl>
                <InfoRow label="案件名" value={project.name} />
                <InfoRow label="案件コード" value={project.code} />
                <InfoRow label="作業場所名" value={project.location_name} />
                <InfoRow label="電話番号" value={project.phone} />
                <InfoRow label="緊急連絡先" value={project.emergency_contact} />
                <InfoRow label="作業可能時間" value={project.business_hours} />
                {project.stores?.clients?.name && (
                  <InfoRow label="顧客" value={project.stores.clients.name} />
                )}
                {project.stores?.name && (
                  <InfoRow label="店舗" value={project.stores.name} />
                )}
                <InfoRow
                  label="開始日"
                  value={project.start_date ? new Date(project.start_date).toLocaleDateString('ja-JP') : null}
                />
                <InfoRow
                  label="終了日"
                  value={project.end_date ? new Date(project.end_date).toLocaleDateString('ja-JP') : null}
                />
              </dl>
            </CardContent>
          </Card>

          {(project.contract_info || project.notes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">詳細</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {project.contract_info && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">契約内容</p>
                    </div>
                    <p className="text-sm text-[var(--color-foreground)] whitespace-pre-wrap">{project.contract_info}</p>
                  </div>
                )}
                {project.notes && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" />
                      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">注意事項</p>
                    </div>
                    <p className="text-sm text-[var(--color-foreground)] whitespace-pre-wrap">{project.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* サイドバー */}
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                <StatusBadge status={project.status} type="project" />
              </div>
              {project.code && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-muted-foreground)]">コード</span>
                  <Badge variant="secondary">{project.code}</Badge>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                <span className="text-sm">{new Date(project.created_at).toLocaleDateString('ja-JP')}</span>
              </div>
            </CardContent>
          </Card>

          <Link href={`/projects/${id}/manuals`} className="block">
            <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-[var(--color-primary)]">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-sm font-medium">マニュアルを管理</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                  AIが参照する資料を登録・管理
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`「${project.name}」を削除しますか？`}
        description="案件に紐づくマニュアル等のデータも削除されます。"
      />
    </div>
  )
}
