'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import {
  Bell, Info, AlertTriangle, AlertCircle, CheckCircle2,
  Wallet, CalendarDays, Briefcase, ClipboardCheck,
} from 'lucide-react'
import { isSafeInternalNotificationPath } from '@/lib/notifications/safe-url'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  target_url: string | null
  created_at: string
}

// notification type から表示アイコンを解決する。
// 未定義 type は info アイコンにフォールバック。
function iconForType(type: string): { icon: React.ElementType; color: string } {
  if (type.startsWith('expense_'))    return { icon: Wallet,         color: 'text-[var(--color-primary)]' }
  if (type.startsWith('attendance_')) return { icon: ClipboardCheck, color: 'text-[var(--color-primary)]' }
  if (type.startsWith('shift_'))      return { icon: CalendarDays,   color: 'text-[var(--color-primary)]' }
  if (type.startsWith('project_'))    return { icon: Briefcase,      color: 'text-[var(--color-primary)]' }
  if (type === 'warning')             return { icon: AlertTriangle,  color: 'text-[var(--color-warning)]' }
  if (type === 'error')               return { icon: AlertCircle,    color: 'text-[var(--color-error)]'   }
  if (type === 'success')             return { icon: CheckCircle2,   color: 'text-[var(--color-success)]' }
  return { icon: Info, color: 'text-[var(--color-primary)]' }
}

export default function NotificationsPage() {
  const router = useRouter()
  const [items, setItems] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [markingAll, setMarkingAll] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const loadNotifications = React.useCallback(async (opts?: { signal?: AbortSignal }) => {
    try {
      const res = await fetch('/api/notifications', {
        credentials: 'include',
        cache:       'no-store',
        signal:      opts?.signal,
      })
      if (!res.ok) return
      const { notifications } = await res.json()
      setItems(notifications ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  // 初回ロード。ページ open だけで既読化しない (以前の auto read-all を廃止)。
  React.useEffect(() => {
    const controller = new AbortController()
    let mounted = true
    ;(async () => {
      await loadNotifications({ signal: controller.signal })
      if (mounted) setLoading(false)
    })()
    return () => {
      mounted = false
      controller.abort()
    }
  }, [loadNotifications])

  // ローディング完了後にスクロールを先頭にリセット（Chromeのscroll anchoring対策）
  React.useEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [loading])

  // 明示的な「すべて既読」ボタン。失敗時は UI を勝手に既読へ変更しない。
  async function handleMarkAll() {
    if (markingAll) return
    setMarkingAll(true)
    try {
      const res = await fetch('/api/notifications/read-all', {
        method:      'PATCH',
        credentials: 'include',
      })
      if (!res.ok) return
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch {
      /* ignore */
    } finally {
      setMarkingAll(false)
    }
  }

  // 通知クリック: 未読なら PATCH → success で local を is_read=true
  // → safe な target_url があれば navigate
  async function handleClick(n: NotificationRow) {
    if (!n.is_read) {
      try {
        const res = await fetch(`/api/notifications/${n.id}/read`, {
          method:      'PATCH',
          credentials: 'include',
        })
        if (res.ok) {
          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
        }
        // 失敗時は UI 上 unread のまま。navigate は続行 (target 側で再取得できる)。
      } catch {
        /* ignore */
      }
    }
    if (isSafeInternalNotificationPath(n.target_url)) {
      router.push(n.target_url)
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div className="bg-[var(--color-background)]" style={{ height: 'calc(100dvh - var(--header-height))' }}>
      <WorkerHeader
        title="通知"
        showBack
        rightAction={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={markingAll}
              className="text-xs font-medium text-[var(--color-primary)] disabled:opacity-40"
            >
              {markingAll ? '処理中...' : 'すべて既読'}
            </button>
          ) : null
        }
      />

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
                      const { icon: Icon, color } = iconForType(n.type)
                      const clickable = isSafeInternalNotificationPath(n.target_url) || !n.is_read
                      return (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleClick(n)}
                          disabled={!clickable}
                          className={cn(
                            'w-full text-left flex items-start gap-3 px-4 py-4 bg-[var(--color-surface)] transition-colors',
                            clickable && 'hover:bg-[var(--color-surface-raised)] cursor-pointer',
                            !clickable && 'cursor-default',
                            !n.is_read && 'bg-[var(--color-primary-muted)]',
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
                        </button>
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
