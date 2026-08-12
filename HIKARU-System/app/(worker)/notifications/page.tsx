'use client'

import * as React from 'react'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle2, CheckCheck } from 'lucide-react'

interface NotificationRow {
  id: string
  title: string
  body: string | null
  type: 'info' | 'warning' | 'error' | 'success'
  is_read: boolean
  target_url: string | null
  created_at: string
}

const typeConfig = {
  info:    { icon: Info,          color: 'text-[var(--color-primary)]'  },
  warning: { icon: AlertTriangle, color: 'text-[var(--color-warning)]'  },
  error:   { icon: AlertCircle,   color: 'text-[var(--color-error)]'    },
  success: { icon: CheckCircle2,  color: 'text-[var(--color-success)]'  },
}

export default function NotificationsPage() {
  const [items,   setItems]   = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error,   setError]   = React.useState<string | null>(null)

  async function fetchNotifications() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/notifications', { credentials: 'include' })
      if (!res.ok) {
        setError('通知の取得に失敗しました')
        return
      }
      const { notifications } = await res.json()
      setItems(notifications ?? [])
    } catch {
      setError('ネットワークエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => { fetchNotifications() }, [])

  async function handleClick(n: NotificationRow) {
    // 未読なら既読化
    if (!n.is_read) {
      try {
        await fetch(`/api/notifications/${n.id}/read`, {
          method: 'PATCH',
          credentials: 'include',
        })
        setItems(prev => prev.map(item =>
          item.id === n.id ? { ...item, is_read: true } : item
        ))
      } catch {
        // 既読化失敗は無視してUX継続
      }
    }
    // target_url があれば遷移
    if (n.target_url) {
      window.location.href = n.target_url
    }
  }

  async function handleReadAll() {
    try {
      await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        credentials: 'include',
      })
      setItems(prev => prev.map(item => ({ ...item, is_read: true })))
    } catch {
      // 失敗しても表示は維持
    }
  }

  const unreadCount = items.filter(n => !n.is_read).length

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader
        title="通知"
        showBack
        rightAction={
          unreadCount > 0 ? (
            <button
              onClick={handleReadAll}
              className="flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors px-2 py-1"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              全て既読
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <AlertCircle className="h-12 w-12 text-[var(--color-error)] opacity-40 mb-3" />
          <p className="text-sm font-medium text-[var(--color-foreground)]">{error}</p>
          <button
            onClick={fetchNotifications}
            className="mt-4 text-xs text-[var(--color-primary)] underline"
          >
            再読み込み
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="h-12 w-12 text-[var(--color-muted-foreground)] opacity-40 mb-3" />
          <p className="text-sm font-medium text-[var(--color-foreground)]">通知はありません</p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {items.map((n) => {
            const { icon: Icon, color } = typeConfig[n.type] ?? typeConfig.info
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-4 text-left transition-colors',
                  !n.is_read
                    ? 'bg-[var(--color-primary-muted)]'
                    : 'hover:bg-[var(--color-surface-hover)]'
                )}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', color)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', !n.is_read && 'font-semibold')}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{n.body}</p>
                  )}
                  <p className="mt-1 text-[10px] text-[var(--color-subtle)]">
                    {new Date(n.created_at).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] shrink-0 mt-1.5" />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
