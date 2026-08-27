'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import { WorkerSidebar }        from './WorkerSidebar'
import { WorkerTopBar }         from './WorkerTopBar'
import { Toaster }              from '@hikaru/ui'
import { SystemVoiceProvider }  from '@/lib/voice/SystemVoiceContext'
import { MiniVoicePanel }       from '@/components/voice/MiniVoicePanel'

interface WorkerLayoutProps {
  children: React.ReactNode
  hideBottomNav?: boolean // 後方互換性のためのダミープロップ
}

export function WorkerLayout({ children }: WorkerLayoutProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [unreadCount, setUnreadCount] = React.useState(0)
  const pathname = usePathname()

  // ページ遷移ごとに未読件数を再取得（通知ページのread-all後も正しく0に更新される）
  React.useEffect(() => {
    fetch('/api/notifications', { credentials: 'include', cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUnreadCount(d.unread_count ?? 0) })
      .catch(() => {})
  }, [pathname])

  return (
    <SystemVoiceProvider>
      <WorkerSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        unreadCount={unreadCount}
      />

      <WorkerTopBar onMobileMenuClick={() => setMobileOpen(true)} unreadCount={unreadCount} />

      {/* メインコンテンツ: デスクトップはサイドバー分右にずらす */}
      <main
        className="min-h-dvh pt-[var(--header-height)] md:pl-[var(--sidebar-width)] transition-all duration-300"
      >
        {children}
      </main>

      <MiniVoicePanel />

      <Toaster
        position="top-center"
        richColors
        expand={false}
        toastOptions={{
          classNames: {
            toast: 'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]',
          },
        }}
      />
    </SystemVoiceProvider>
  )
}

// 後方互換性のためのダミー Context（MenuButton から参照されていた）
export const MenuContext = React.createContext<{ openMenu: () => void }>({ openMenu: () => {} })
export function useMenuContext() { return React.useContext(MenuContext) }
