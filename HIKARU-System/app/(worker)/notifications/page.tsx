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

// ---- 一時診断パネル ----
interface DiagData {
  ts: string
  win: { innerHeight: number; scrollY: number; docScrollH: number; docClientH: number }
  pageRoot: { inlineStyle: string; computedH: string; top: number; bottom: number } | null
  header: { position: string; top: string; height: string; rectTop: number; rectBottom: number } | null
  scroll: { inlineStyle: string; computedH: string; overflowY: string; overflowAnchor: string; scrollTop: number; clientH: number; scrollH: number; rectTop: number; rectBottom: number } | null
  first: { top: number; bottom: number; overlapPx: number } | null
  isLatestCode: boolean
  verdict: string
}

function measure(): DiagData {
  const win = {
    innerHeight: window.innerHeight,
    scrollY: window.scrollY,
    docScrollH: document.documentElement.scrollHeight,
    docClientH: document.documentElement.clientHeight,
  }

  const pageRootEl = document.querySelector('main > div') as HTMLElement | null
  let pageRoot: DiagData['pageRoot'] = null
  if (pageRootEl) {
    const cs = getComputedStyle(pageRootEl)
    const r = pageRootEl.getBoundingClientRect()
    pageRoot = {
      inlineStyle: pageRootEl.getAttribute('style') ?? '',
      computedH: cs.height,
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
    }
  }

  const headerEl = document.querySelector('header[class*="sticky"]') as HTMLElement | null
  let header: DiagData['header'] = null
  if (headerEl) {
    const cs = getComputedStyle(headerEl)
    const r = headerEl.getBoundingClientRect()
    header = {
      position: cs.position,
      top: cs.top,
      height: cs.height,
      rectTop: Math.round(r.top),
      rectBottom: Math.round(r.bottom),
    }
  }

  const scrollEl = (document.querySelector('div[style*="overflow"]') ??
    Array.from(document.querySelectorAll('div')).find(el => {
      const oy = getComputedStyle(el).overflowY
      return oy === 'auto' || oy === 'scroll'
    })) as HTMLElement | null
  let scroll: DiagData['scroll'] = null
  if (scrollEl) {
    const cs = getComputedStyle(scrollEl)
    const r = scrollEl.getBoundingClientRect()
    scroll = {
      inlineStyle: scrollEl.getAttribute('style') ?? '',
      computedH: cs.height,
      overflowY: cs.overflowY,
      overflowAnchor: cs.overflowAnchor ?? '',
      scrollTop: scrollEl.scrollTop,
      clientH: scrollEl.clientHeight,
      scrollH: scrollEl.scrollHeight,
      rectTop: Math.round(r.top),
      rectBottom: Math.round(r.bottom),
    }
  }

  const firstEl = (document.querySelector('[class*="divide-y"] > div') ??
    document.querySelector('[class*="py-4"][class*="px-4"]')) as HTMLElement | null
  let first: DiagData['first'] = null
  if (firstEl && header) {
    const r = firstEl.getBoundingClientRect()
    first = {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      overlapPx: Math.round(header.rectBottom - r.top),
    }
  }

  const prStyle = pageRoot?.inlineStyle ?? ''
  const scStyle = scroll?.inlineStyle ?? ''
  const isLatestCode =
    prStyle.includes('100dvh') &&
    (scStyle.includes('overflowAnchor') || (scroll?.overflowAnchor === 'none'))

  const verdict = isLatestCode
    ? 'A: LATEST CODE (bc2cb6d)'
    : prStyle.includes('100dvh')
    ? 'A: MID CODE (5dee84d?)'
    : 'B: OLD CODE (min-h-dvh)'

  return { ts: new Date().toLocaleTimeString('ja-JP'), win, pageRoot, header, scroll, first, isLatestCode, verdict }
}

function DiagPanel() {
  const [d, setD] = React.useState<DiagData | null>(null)
  const [open, setOpen] = React.useState(true)

  React.useEffect(() => {
    // 初回
    setD(measure())
    // 500ms後
    const t1 = setTimeout(() => setD(measure()), 500)
    // 2000ms後（データ取得完了後）
    const t2 = setTimeout(() => setD(measure()), 2000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (!open || !d) return (
    <button
      onClick={() => setOpen(true)}
      style={{ position: 'fixed', bottom: 10, right: 10, zIndex: 9999,
               background: '#111', color: '#0f0', fontSize: 10, padding: '4px 8px', borderRadius: 4 }}
    >
      DIAG
    </button>
  )

  const row = (label: string, value: string | number | null | undefined) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <span style={{ color: '#aaa', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: '#0f0', wordBreak: 'break-all' }}>{String(value ?? 'null')}</span>
    </div>
  )

  return (
    <div style={{
      position: 'fixed', bottom: 10, right: 10, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)', color: '#fff',
      fontSize: 10, fontFamily: 'monospace',
      padding: 10, borderRadius: 6, maxWidth: 320,
      maxHeight: '60dvh', overflowY: 'auto',
      border: d.isLatestCode ? '1px solid #0f0' : '1px solid #f80',
      lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <b style={{ color: d.isLatestCode ? '#0f0' : '#f80', fontSize: 11 }}>
          {d.verdict}
        </b>
        <button onClick={() => setOpen(false)} style={{ background: 'none', color: '#888', border: 'none', cursor: 'pointer', fontSize: 12 }}>✕</button>
      </div>
      <div style={{ color: '#555', marginBottom: 4 }}>@{d.ts}</div>

      <div style={{ color: '#ff0', marginTop: 4 }}>── window ──</div>
      {row('innerHeight', d.win.innerHeight)}
      {row('scrollY', d.win.scrollY)}
      {row('doc.scrollH', d.win.docScrollH)}
      {row('doc.clientH', d.win.docClientH)}
      {row('doc overflow', d.win.docScrollH - d.win.docClientH)}

      <div style={{ color: '#ff0', marginTop: 4 }}>── pageRoot ──</div>
      {row('inlineStyle', d.pageRoot?.inlineStyle)}
      {row('computedH', d.pageRoot?.computedH)}
      {row('rect.top', d.pageRoot?.top)}
      {row('rect.bottom', d.pageRoot?.bottom)}

      <div style={{ color: '#ff0', marginTop: 4 }}>── WorkerHeader ──</div>
      {row('position', d.header?.position)}
      {row('top', d.header?.top)}
      {row('height', d.header?.height)}
      {row('rect.top', d.header?.rectTop)}
      {row('rect.bottom', d.header?.rectBottom)}

      <div style={{ color: '#ff0', marginTop: 4 }}>── scrollContainer ──</div>
      {row('inlineStyle', d.scroll?.inlineStyle)}
      {row('computedH', d.scroll?.computedH)}
      {row('overflowY', d.scroll?.overflowY)}
      {row('overflowAnchor', d.scroll?.overflowAnchor)}
      {row('scrollTop', d.scroll?.scrollTop)}
      {row('clientH', d.scroll?.clientH)}
      {row('scrollH', d.scroll?.scrollH)}
      {row('rect.top', d.scroll?.rectTop)}
      {row('rect.bottom', d.scroll?.rectBottom)}

      <div style={{ color: '#ff0', marginTop: 4 }}>── firstNotification ──</div>
      {row('rect.top', d.first?.top ?? 'loading...')}
      {row('rect.bottom', d.first?.bottom ?? 'loading...')}
      {row('overlap px', d.first?.overlapPx ?? 'loading...')}
    </div>
  )
}
// ---- /一時診断パネル ----

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
                    <p className={cn('text-sm font-medium text-[var(--color-foreground)]', !n.is_read && 'font-semibold')}>
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

      {/* 一時診断パネル - 原因確定後に削除 */}
      <DiagPanel />
    </div>
  )
}
