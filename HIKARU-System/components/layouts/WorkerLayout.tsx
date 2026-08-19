'use client'

import * as React from 'react'
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

  return (
    <SystemVoiceProvider>
      <WorkerSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <WorkerTopBar onMobileMenuClick={() => setMobileOpen(true)} />

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
