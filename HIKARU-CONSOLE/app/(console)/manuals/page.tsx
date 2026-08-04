'use client'

import * as React from 'react'
import Link from 'next/link'
import { listAllManuals, manualTypeLabel, type ManualType } from '@/services/manuals.service'
import {
  PageHeader, Button, SearchBar, Badge, Card, CardContent, Skeleton,
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { BookOpen, FileText, Image, Video, HelpCircle, AlertTriangle, ArrowRight } from 'lucide-react'

const TYPE_OPTIONS: { value: ManualType | ''; label: string }[] = [
  { value: '',      label: 'すべて' },
  { value: 'text',  label: '文章' },
  { value: 'faq',   label: 'FAQ' },
  { value: 'note',  label: '注意事項' },
  { value: 'pdf',   label: 'PDF' },
  { value: 'image', label: '画像' },
  { value: 'video', label: '動画' },
]

const typeIcon: Record<ManualType, React.ElementType> = {
  text:  FileText,
  faq:   HelpCircle,
  note:  AlertTriangle,
  pdf:   FileText,
  image: Image,
  video: Video,
}

const typeVariant: Record<ManualType, any> = {
  text:  'secondary',
  faq:   'info',
  note:  'warning',
  pdf:   'default',
  image: 'success',
  video: 'error',
}

export default function ManualsPage() {
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [type, setType] = React.useState<ManualType | ''>('')

  React.useEffect(() => {
    fetchManuals()
  }, [search, type]) // eslint-disable-line

  async function fetchManuals() {
    setLoading(true)
    const { data } = await listAllManuals({ search, type })
    setItems(data ?? [])
    setLoading(false)
  }

  return (
    <div>
      <PageHeader
        title="マニュアル管理"
        description="全案件のマニュアル一覧"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="タイトル・内容で検索"
          className="w-72"
        />
        <div>
          <Select value={type} onValueChange={(v) => setType(v as ManualType | '')}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="種別" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<BookOpen className="h-12 w-12" />}
              title="マニュアルが見つかりません"
              description="案件詳細ページからマニュアルを追加できます"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((manual) => {
            const Icon = typeIcon[manual.type as ManualType] ?? FileText
            return (
              <Card key={manual.id} className="group hover:shadow-[var(--shadow-md)] transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-muted-foreground)]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{manual.title}</p>
                        <Badge variant={typeVariant[manual.type as ManualType]} size="sm">
                          {manualTypeLabel[manual.type as ManualType]}
                        </Badge>
                      </div>
                      {manual.content && (
                        <p className="mt-1 text-xs text-[var(--color-muted-foreground)] line-clamp-2">{manual.content}</p>
                      )}
                      {manual.projects && (
                        <Link
                          href={`/projects/${manual.project_id}/manuals`}
                          className="mt-2 flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                        >
                          {manual.projects.name}
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
