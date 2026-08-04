'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getStore } from '@/services/stores.service'
import {
  listLocations, createLocation, updateLocation, deleteLocation, reorderLocations,
  type LocationRow,
} from '@/services/locations.service'
import {
  listPhotoSpots, createPhotoSpot, updatePhotoSpot, deletePhotoSpot, reorderPhotoSpots,
  type PhotoSpotRow,
} from '@/services/photo-spots.service'
import {
  PageHeader, Button, Card, CardContent, CardHeader, CardTitle,
  Badge, Skeleton, toast, Breadcrumb, Tabs, TabsList, TabsTrigger, TabsContent,
  Input, Textarea, Switch,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
} from '@hikaru/ui'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import { EmptyState } from '@/components/console/EmptyState'
import {
  Pencil, Plus, Trash2, ChevronUp, ChevronDown, MapPin, Phone,
  Clock, User, ShieldAlert, FileText, Camera, List,
} from 'lucide-react'

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="py-2.5 border-b border-[var(--color-border)] last:border-0">
      <dt className="text-xs font-medium text-[var(--color-muted-foreground)] mb-0.5">{label}</dt>
      <dd className="text-sm text-[var(--color-foreground)]">{value || '—'}</dd>
    </div>
  )
}

// ---- Locations Tab ----
function LocationsTab({ storeId }: { storeId: string }) {
  const [items, setItems] = React.useState<LocationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [newName, setNewName] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [deleteTarget, setDeleteTarget] = React.useState<LocationRow | null>(null)

  async function refresh() {
    const { data } = await listLocations(storeId)
    setItems(data ?? [])
    setLoading(false)
  }

  React.useEffect(() => { refresh() }, [storeId]) // eslint-disable-line

  async function handleAdd() {
    if (!newName.trim()) return
    setAdding(true)
    const { error } = await createLocation(storeId, newName.trim())
    if (error) { toast.error('追加に失敗しました') } else { toast.success('追加しました'); setNewName('') }
    await refresh()
    setAdding(false)
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return
    const { error } = await updateLocation(id, { name: editName.trim() })
    if (error) { toast.error('更新に失敗しました') } else { toast.success('更新しました') }
    setEditId(null)
    refresh()
  }

  async function handleToggleActive(item: LocationRow) {
    await updateLocation(item.id, { is_active: !item.is_active })
    refresh()
  }

  async function handleMove(idx: number, dir: 'up' | 'down') {
    const newItems = [...items]
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newItems.length) return
    ;[newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]]
    setItems(newItems)
    await reorderLocations(storeId, newItems.map((i) => i.id))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deleteLocation(deleteTarget.id)
    if (error) { toast.error('削除に失敗しました') } else { toast.success('削除しました') }
    refresh()
  }

  if (loading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="space-y-4">
      {/* 追加フォーム */}
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="作業場所名（例: 入口、床、トイレ）"
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={adding || !newName.trim()}>
          <Plus className="h-4 w-4" /> 追加
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<List className="h-10 w-10" />} title="作業場所が登録されていません" description="上のフォームから追加してください" />
      ) : (
        <div className="space-y-1.5">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center gap-2 rounded-[var(--radius-lg)] border px-3 py-2 ${item.is_active ? 'border-[var(--color-border)] bg-[var(--color-surface)]' : 'border-dashed border-[var(--color-border)] bg-[var(--color-muted)] opacity-60'}`}
            >
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon-sm" onClick={() => handleMove(idx, 'up')} disabled={idx === 0}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleMove(idx, 'down')} disabled={idx === items.length - 1}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>

              <span className="w-6 text-center text-xs text-[var(--color-muted-foreground)]">{idx + 1}</span>

              {editId === item.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')  { e.preventDefault(); handleEdit(item.id) }
                    if (e.key === 'Escape') setEditId(null)
                  }}
                />
              ) : (
                <span className="flex-1 text-sm">{item.name}</span>
              )}

              <div className="flex items-center gap-1 shrink-0">
                <Switch
                  checked={item.is_active}
                  onCheckedChange={() => handleToggleActive(item)}
                  className="scale-75"
                />
                {editId === item.id ? (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => handleEdit(item.id)}><Plus className="h-3.5 w-3.5 rotate-45" /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditId(null)}><Plus className="h-3.5 w-3.5 rotate-45 scale-125" /></Button>
                  </>
                ) : (
                  <Button variant="ghost" size="icon-sm" onClick={() => { setEditId(item.id); setEditName(item.name) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)]" onClick={() => setDeleteTarget(item)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`「${deleteTarget?.name}」を削除しますか？`}
      />
    </div>
  )
}

// ---- Photo Spots Tab ----
function PhotoSpotsDialog({
  open, onClose, storeId, spot, onSaved,
}: { open: boolean; onClose: () => void; storeId: string; spot?: PhotoSpotRow | null; onSaved: () => void }) {
  const [loading, setLoading] = React.useState(false)
  const [form, setForm] = React.useState({ name: '', description: '', is_required: true, ref_image_url: '' })

  React.useEffect(() => {
    if (spot) {
      setForm({ name: spot.name, description: spot.description ?? '', is_required: spot.is_required, ref_image_url: spot.ref_image_url ?? '' })
    } else {
      setForm({ name: '', description: '', is_required: true, ref_image_url: '' })
    }
  }, [spot, open])

  async function handleSave() {
    if (!form.name.trim()) { toast.error('撮影箇所名を入力してください'); return }
    setLoading(true)
    const payload = { name: form.name.trim(), description: form.description.trim() || null, is_required: form.is_required, ref_image_url: form.ref_image_url.trim() || null }
    const { error } = spot
      ? await updatePhotoSpot(spot.id, payload)
      : await createPhotoSpot(storeId, payload)
    if (error) { toast.error('保存に失敗しました') } else { toast.success('保存しました'); onSaved(); onClose() }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{spot ? '撮影箇所を編集' : '撮影箇所を追加'}</DialogTitle></DialogHeader>
        <DialogBody className="space-y-4">
          <Input label="撮影箇所名 *" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="例: 入口ドア" />
          <Textarea label="説明" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="撮影のポイントや注意事項" />
          <Input label="参考画像URL" value={form.ref_image_url} onChange={(e) => setForm((p) => ({ ...p, ref_image_url: e.target.value }))} placeholder="https://..." />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">必須撮影</span>
            <Switch checked={form.is_required} onCheckedChange={(v) => setForm((p) => ({ ...p, is_required: v }))} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>キャンセル</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PhotoSpotsTab({ storeId }: { storeId: string }) {
  const [items, setItems] = React.useState<PhotoSpotRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<PhotoSpotRow | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<PhotoSpotRow | null>(null)

  async function refresh() {
    const { data } = await listPhotoSpots(storeId)
    setItems(data ?? [])
    setLoading(false)
  }

  React.useEffect(() => { refresh() }, [storeId]) // eslint-disable-line

  async function handleMove(idx: number, dir: 'up' | 'down') {
    const newItems = [...items]
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newItems.length) return
    ;[newItems[idx], newItems[targetIdx]] = [newItems[targetIdx], newItems[idx]]
    setItems(newItems)
    await reorderPhotoSpots(storeId, newItems.map((i) => i.id))
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await deletePhotoSpot(deleteTarget.id)
    if (error) { toast.error('削除に失敗しました') } else { toast.success('削除しました') }
    refresh()
  }

  if (loading) return <Skeleton className="h-40 w-full" />

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditTarget(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" /> 撮影箇所を追加
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-10 w-10" />}
          title="撮影箇所が登録されていません"
          action={<Button onClick={() => { setEditTarget(null); setDialogOpen(true) }}><Plus className="h-4 w-4" /> 追加</Button>}
        />
      ) : (
        <div className="space-y-2">
          {items.map((spot, idx) => (
            <div
              key={spot.id}
              className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <Button variant="ghost" size="icon-sm" onClick={() => handleMove(idx, 'up')} disabled={idx === 0}><ChevronUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleMove(idx, 'down')} disabled={idx === items.length - 1}><ChevronDown className="h-3.5 w-3.5" /></Button>
              </div>
              <span className="w-6 text-center text-xs text-[var(--color-muted-foreground)]">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{spot.name}</span>
                  {spot.is_required
                    ? <Badge variant="default" size="sm">必須</Badge>
                    : <Badge variant="secondary" size="sm">任意</Badge>
                  }
                </div>
                {spot.description && <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 truncate">{spot.description}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => { setEditTarget(spot); setDialogOpen(true) }}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)]" onClick={() => setDeleteTarget(spot)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <PhotoSpotsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} storeId={storeId} spot={editTarget} onSaved={refresh} />
      <ConfirmDeleteDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title={`「${deleteTarget?.name}」を削除しますか？`} />
    </div>
  )
}

// ---- Main Page ----
export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [store, setStore] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    getStore(id).then(({ data }) => { setStore(data); setLoading(false) })
  }, [id])

  if (loading) return (
    <div>
      <Skeleton className="h-8 w-48 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  )

  if (!store) return (
    <div className="text-center py-16">
      <p className="text-[var(--color-muted-foreground)]">店舗が見つかりませんでした</p>
      <Link href="/stores"><Button variant="outline" className="mt-4">一覧に戻る</Button></Link>
    </div>
  )

  return (
    <div>
      <PageHeader
        title={store.name}
        breadcrumb={<Breadcrumb items={[{ label: '店舗管理', href: '/stores' }, { label: store.name }]} />}
        actions={
          <div className="flex gap-2">
            <Link href={`/stores/${id}/edit`}>
              <Button variant="outline"><Pencil className="h-4 w-4" /> 編集</Button>
            </Link>
          </div>
        }
      />

      <Tabs defaultValue="info">
        <TabsList className="mb-4">
          <TabsTrigger value="info">店舗情報</TabsTrigger>
          <TabsTrigger value="locations">作業場所</TabsTrigger>
          <TabsTrigger value="photo-spots">撮影箇所</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader><CardTitle className="text-base">基本情報</CardTitle></CardHeader>
                <CardContent>
                  <dl>
                    <InfoRow label="店舗名" value={store.name} />
                    <InfoRow label="店舗コード" value={store.code} />
                    <InfoRow label="顧客" value={store.clients?.name} />
                    <InfoRow label="住所" value={store.address} />
                    <InfoRow label="電話番号" value={store.phone} />
                    <InfoRow label="営業時間" value={store.business_hours} />
                  </dl>
                </CardContent>
              </Card>
              {(store.manager_name || store.emergency_contact || store.contract_info || store.notes) && (
                <Card>
                  <CardHeader><CardTitle className="text-base">責任者・契約</CardTitle></CardHeader>
                  <CardContent>
                    <dl>
                      <InfoRow label="責任者" value={store.manager_name} />
                      <InfoRow label="緊急連絡先" value={store.emergency_contact} />
                      <InfoRow label="契約情報" value={store.contract_info} />
                      <InfoRow label="備考" value={store.notes} />
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>
            <div>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-muted-foreground)]">ステータス</span>
                    <Badge variant={store.is_active ? 'success' : 'secondary'}>{store.is_active ? '有効' : '無効'}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-muted-foreground)]">登録日</span>
                    <span className="text-sm">{new Date(store.created_at).toLocaleDateString('ja-JP')}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <List className="h-4 w-4" /> 作業場所
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LocationsTab storeId={id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="photo-spots">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" /> 撮影箇所
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoSpotsTab storeId={id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
