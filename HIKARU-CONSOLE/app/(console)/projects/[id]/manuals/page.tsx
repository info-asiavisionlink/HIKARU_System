'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import { getProject } from '@/services/projects.service'
import {
  listManuals, createManual, updateManual, deleteManual,
  manualTypeLabel, type ManualRow, type ManualType,
} from '@/services/manuals.service'
import {
  PageHeader, Button, Input, Textarea, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Breadcrumb,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import { EmptyState } from '@/components/console/EmptyState'
import { Plus, BookOpen, Pencil, Trash2, FileText, Image, Video, MessageSquare, HelpCircle, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

const TYPE_OPTIONS: { value: ManualType; label: string; icon: React.ElementType }[] = [
  { value: 'text',  label: '文章',     icon: FileText },
  { value: 'faq',   label: 'FAQ',      icon: HelpCircle },
  { value: 'note',  label: '注意事項', icon: AlertTriangle },
  { value: 'pdf',   label: 'PDF',      icon: FileText },
  { value: 'image', label: '画像',     icon: Image },
  { value: 'video', label: '動画',     icon: Video },
]

const typeVariant: Record<ManualType, any> = {
  text:  'secondary',
  faq:   'info',
  note:  'warning',
  pdf:   'default',
  image: 'success',
  video: 'error',
}

function ManualFormDialog({
  open,
  onClose,
  projectId,
  manual,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  manual?: ManualRow | null
  onSaved: () => void
}) {
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ type: 'text' as ManualType, title: '', content: '', file_url: '' })

  React.useEffect(() => {
    if (manual) {
      setForm({
        type:     manual.type,
        title:    manual.title,
        content:  manual.content ?? '',
        file_url: manual.file_url ?? '',
      })
    } else {
      setForm({ type: 'text', title: '', content: '', file_url: '' })
    }
  }, [manual, open])

  async function handleSave() {
    if (!form.title.trim()) { toast.error('タイトルを入力してください'); return }
    setLoading(true)

    const payload = {
      type:     form.type,
      title:    form.title.trim(),
      content:  form.content.trim() || null,
      file_url: form.file_url.trim() || null,
    }

    const { error } = manual
      ? await updateManual(manual.id, payload)
      : await createManual({ project_id: projectId, ...payload })

    if (error) {
      toast.error('保存に失敗しました')
    } else {
      toast.success(manual ? 'マニュアルを更新しました' : 'マニュアルを追加しました')
      onSaved()
      onClose()
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{manual ? 'マニュアルを編集' : 'マニュアルを追加'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--color-foreground)]">種別</label>
            <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as ManualType }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            label="タイトル *"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            placeholder="マニュアルのタイトル"
          />
          {['text', 'faq', 'note'].includes(form.type) && (
            <Textarea
              label="内容"
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
              placeholder="内容を入力"
              rows={5}
            />
          )}
          {['pdf', 'image', 'video'].includes(form.type) && (
            <Input
              label="ファイルURL"
              value={form.file_url}
              onChange={(e) => setForm((p) => ({ ...p, file_url: e.target.value }))}
              placeholder="https://..."
              hint="Supabase StorageのURLを入力"
            />
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ProjectManualsPage() {
  const { id } = useParams<{ id: string }>()
  const [project, setProject] = React.useState<any>(null)
  const [manuals, setManuals] = React.useState<ManualRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<ManualRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<ManualRow | null>(null)

  React.useEffect(() => {
    Promise.all([getProject(id), listManuals(id)]).then(([pRes, mRes]) => {
      setProject(pRes.data)
      setManuals(mRes.data ?? [])
      setLoading(false)
    })
  }, [id])

  async function refresh() {
    const { data } = await listManuals(id)
    setManuals(data ?? [])
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteManual(deleteTarget.id)
    if (error) { toast.error('削除に失敗しました'); return }
    toast.success('削除しました')
    refresh()
  }

  return (
    <div>
      <PageHeader
        title="マニュアル管理"
        description={project?.name ? `${project.name} のマニュアル` : ''}
        breadcrumb={
          <Breadcrumb items={[
            { label: '案件管理', href: '/projects' },
            { label: project?.name ?? '...', href: `/projects/${id}` },
            { label: 'マニュアル' },
          ]} />
        }
        actions={
          <Button onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4" /> 追加
          </Button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : manuals.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<BookOpen className="h-12 w-12" />}
              title="マニュアルがありません"
              description="AIが参照する資料を追加してください"
              action={
                <Button onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
                  <Plus className="h-4 w-4" /> 追加
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {manuals.map((manual) => {
            const typeOpt = TYPE_OPTIONS.find((t) => t.value === manual.type)
            const Icon = typeOpt?.icon ?? FileText
            return (
              <Card key={manual.id} className="group">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{manual.title}</p>
                        {manual.content && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)] line-clamp-2">{manual.content}</p>
                        )}
                        {manual.file_url && (
                          <a href={manual.file_url} target="_blank" rel="noopener noreferrer" className="mt-1 text-xs text-[var(--color-primary)] hover:underline block truncate">
                            ファイルを開く
                          </a>
                        )}
                      </div>
                    </div>
                    <Badge variant={typeVariant[manual.type]} size="sm">{manualTypeLabel[manual.type]}</Badge>
                  </div>
                  <div className="mt-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={() => { setEditTarget(manual); setDialogOpen(true) }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="icon-sm"
                      className="text-[var(--color-error)]"
                      onClick={() => setDeleteTarget(manual)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ManualFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={id}
        manual={editTarget}
        onSaved={refresh}
      />
      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`「${deleteTarget?.title}」を削除しますか？`}
      />
    </div>
  )
}
