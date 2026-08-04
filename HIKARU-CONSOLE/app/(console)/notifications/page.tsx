'use client'

import * as React from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, toast,
} from '@hikaru/ui'
import { EmptyState } from '@/components/console/EmptyState'
import { Bell, CheckCheck, Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@hikaru/ui'

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
  info:    { icon: Info,         variant: 'info'    as const, label: '情報' },
  warning: { icon: AlertTriangle, variant: 'warning' as const, label: '警告' },
  error:   { icon: AlertCircle,  variant: 'error'   as const, label: 'エラー' },
  success: { icon: CheckCircle2, variant: 'success' as const, label: '成功' },
}

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => { fetchNotifications() }, [])

  async function fetchNotifications() {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    setItems((data as NotificationRow[]) ?? [])
    setLoading(false)
  }

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = items.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds)
    if (error) { toast.error('更新に失敗しました'); return }
    toast.success('すべて既読にしました')
    fetchNotifications()
  }

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n))
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <div>
      <PageHeader
        title="通知管理"
        description={unreadCount > 0 ? `未読 ${unreadCount}件` : ''}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" /> すべて既読
            </Button>
          )
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Bell className="h-12 w-12" />}
              title="通知はありません"
              description="システムからの通知がここに表示されます"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((notification) => {
            const config = typeConfig[notification.type]
            const Icon = config.icon
            return (
              <div
                key={notification.id}
                className={cn(
                  'flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 cursor-pointer transition-colors',
                  notification.is_read
                    ? 'border-[var(--color-border)] bg-[var(--color-surface)]'
                    : 'border-[var(--color-primary)]/30 bg-[var(--color-primary-muted)]'
                )}
                onClick={() => !notification.is_read && markRead(notification.id)}
              >
                <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', `text-[var(--color-${notification.type === 'error' ? 'error' : notification.type === 'warning' ? 'warning' : notification.type === 'success' ? 'success' : 'primary'})]`)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-medium', !notification.is_read && 'font-semibold')}>
                      {notification.title}
                    </p>
                    <Badge variant={config.variant} size="sm">{config.label}</Badge>
                    {!notification.is_read && (
                      <span className="h-2 w-2 rounded-full bg-[var(--color-primary)] shrink-0" />
                    )}
                  </div>
                  {notification.body && (
                    <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{notification.body}</p>
                  )}
                  <p className="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
                    {new Date(notification.created_at).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
