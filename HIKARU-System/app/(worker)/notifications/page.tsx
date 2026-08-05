'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import { WorkerHeader } from '@/components/layouts/WorkerHeader'
import { cn } from '@hikaru/ui'
import { Bell, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'

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
  const [items, setItems] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)
      setItems((data as NotificationRow[]) ?? [])
      setLoading(false)

      // 既読にする
      const unread = (data ?? []).filter((n: any) => !n.is_read).map((n: any) => n.id)
      if (unread.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', unread)
      }
    }
    load()
  }, [])

  return (
    <div className="min-h-dvh bg-[var(--color-background)]">
      <WorkerHeader title="通知" showBack />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
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
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 px-4 py-4',
                  !n.is_read && 'bg-[var(--color-primary-muted)]'
                )}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', color)} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', !n.is_read && 'font-semibold')}>
                    {n.title}
                  </p>
                  {n.body && <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{n.body}</p>}
                  <p className="mt-1 text-[10px] text-[var(--color-subtle)]">
                    {new Date(n.created_at).toLocaleString('ja-JP', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!n.is_read && <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] shrink-0 mt-1.5" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
