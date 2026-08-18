'use client'

import * as React from 'react'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  target_url: string | null
  created_at: string
}

const typeConfig: Record<string, { icon: React.ElementType; color: string }> = {
  info:    { icon: Info,          color: 'text-[var(--color-primary)]' },
  warning: { icon: AlertTriangle, color: 'text-[var(--color-warning)]' },
  error:   { icon: AlertCircle,   color: 'text-[var(--color-error)]'   },
  success: { icon: CheckCircle2,  color: 'text-[var(--color-success)]' },
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    async function load() {
      try {
        // Server API経由でWorker向け通知を取得（Browser Supabase auth hang回避）
        const res = await fetch('/api/notifications', {
          credentials: 'include',
          cache:       'no-store',
        })
        if (!res.ok) return
        const { notifications } = await res.json()
        setItems(notifications ?? [])

        // 未読があれば一括既読化（Server API経由・fire-and-forget）
        const hasUnread = (notifications ?? []).some((n: NotificationRow) => !n.is_read)
        if (hasUnread) {
          fetch('/api/notifications/read-all', {
            method:      'PATCH',
            credentials: 'include',
          }).catch(() => {})
        }
      } catch {
        // エラー時もLoading解除
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ローディング完了後にスクロールを先頭にリセット（Chromeのscroll anchoring対策）
  React.useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [loading])

  return (
    <div className="bg-[var(--color-background)]" style={{ height: 'calc(100dvh - var(--header-height))' }}>
      <WorkerHeader title="通知" showBack />

      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{
          height: 'calc(100dvh - calc(var(--header-height) * 2))',
          overflowAnchor: 'none',
        }}
      >
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <Bell className="h-14 w-14 text-[var(--color-muted-foreground)] opacity-30 mb-4" />
            <p className="text-sm font-semibold text-[var(--color-foreground)]">通知はありません</p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">新しい通知が届くとここに表示されます</p>
          </div>
        ) : (
          <div className="pb-8">
            {(() => {
              const groups: { label: string; items: NotificationRow[] }[] = []
              for (const n of items) {
                const d = new Date(n.created_at)
                const today = new Date()
                const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
                const label =
                  d.toDateString() === today.toDateString()     ? '今日' :
                  d.toDateString() === yesterday.toDateString() ? '昨日' :
                  d.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })
                const last = groups[groups.length - 1]
                if (last?.label === label) last.items.push(n)
                else groups.push({ label, items: [n] })
              }
              return groups.map(({ label, items: groupItems }) => (
                <div key={label}>
                  <div className="px-4 pt-5 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-subtle)]">
                      {label}
                    </span>
                  </div>
                  <div className="mx-4 rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                    {groupItems.map((n) => {
                      const { icon: Icon, color } = typeConfig[n.type] ?? typeConfig.info
                      return (
                        <div
                          key={n.id}
                          className={cn(
                            'flex items-start gap-3 px-4 py-4 bg-[var(--color-surface)]',
                            !n.is_read && 'bg-[var(--color-primary-muted)]'
                          )}
                        >
                          <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', color)} />
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm text-[var(--color-foreground)]', !n.is_read ? 'font-semibold' : 'font-medium')}>
                              {n.title}
                            </p>
                            {n.body && <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)] leading-relaxed">{n.body}</p>}
                            <p className="mt-1.5 text-[10px] text-[var(--color-subtle)]">
                              {new Date(n.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] shrink-0 mt-1.5" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            })()}
          </div>
        )}
      </div>

    </div>
  )
}
