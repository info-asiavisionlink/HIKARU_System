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

  // 未読件数の同期方針:
  //   - 初回 mount / pathname 変化: 即 fetch (read-all 後の badge=0 を即反映)
  //   - 30秒 polling: バックグラウンドで開かれた画面でも新着を検知
  //   - unmount 時 / pathname 切り替わり時に interval を必ず cleanup
  //   - AbortController で in-flight 要求も打ち切り、setState-after-unmount を防ぐ
  React.useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function fetchUnread() {
      try {
        const res = await fetch('/api/notifications', {
          credentials: 'include',
          cache:       'no-store',
          signal:      controller.signal,
        })
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setUnreadCount(d?.unread_count ?? 0)
      } catch {
        /* AbortError / network 失敗は無視 (badge は既存値保持) */
      }
    }

    void fetchUnread()
    const intervalId = setInterval(fetchUnread, 30_000)

    return () => {
      cancelled = true
      controller.abort()
      clearInterval(intervalId)
    }
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
