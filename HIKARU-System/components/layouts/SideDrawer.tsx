'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Briefcase, Calendar, Bell, User, X, LogOut } from 'lucide-react'
import { cn } from '@hikaru/ui'

const navItems = [
  { label: 'ホーム',       href: '/home',          icon: Home },
  { label: '案件',         href: '/jobs',           icon: Briefcase },
  { label: 'スケジュール', href: '/schedule',       icon: Calendar },
  { label: '通知',         href: '/notifications',  icon: Bell },
  { label: 'プロフィール', href: '/profile',        icon: User },
]

interface SideDrawerProps {
  open: boolean
  onClose: () => void
}

export function SideDrawer({ open, onClose }: SideDrawerProps) {
  const pathname = usePathname()

  // ESCキーで閉じる
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 開いている間はスクロールを止める
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[200] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        style={{ background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-[201] w-72 flex flex-col',
          'transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
        style={{
          background: 'oklch(0.06 0.003 260)',
          borderRight: '1px solid oklch(0.73 0.12 78 / 0.18)',
          boxShadow: '4px 0 40px oklch(0 0 0 / 0.6)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-[var(--header-height)] shrink-0"
          style={{ borderBottom: '1px solid oklch(0.73 0.12 78 / 0.15)' }}
        >
          {/* HIKARU Logo */}
          <div>
            <span
              className="text-[11px] font-black tracking-[0.35em] uppercase"
              style={{
                background: 'linear-gradient(90deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), oklch(0.73 0.12 78))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              HIKARU
            </span>
            <p className="text-[9px] tracking-widest mt-0.5" style={{ color: 'oklch(0.40 0.005 75)' }}>
              AI PLATFORM
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-1.5 transition-all duration-150 active:scale-90"
            style={{ color: 'oklch(0.45 0.006 75)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
              e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'oklch(0.45 0.006 75)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-3 rounded-xl relative transition-all duration-200 active:scale-[0.98] group"
                style={{
                  color: isActive ? 'oklch(0.82 0.13 78)' : 'oklch(0.55 0.007 75)',
                  background: isActive ? 'oklch(0.73 0.12 78 / 0.10)' : 'transparent',
                  borderLeft: isActive ? '2px solid oklch(0.73 0.12 78 / 0.80)' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'oklch(0.75 0.01 75)'
                    e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.05)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'oklch(0.55 0.007 75)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <Icon
                  className="h-5 w-5 shrink-0 transition-all duration-200"
                  style={isActive ? { filter: 'drop-shadow(0 0 6px oklch(0.73 0.12 78 / 0.7))' } : {}}
                />
                <span className="text-sm font-medium">{item.label}</span>

                {/* Active glow dot */}
                {isActive && (
                  <span
                    className="ml-auto h-1.5 w-1.5 rounded-full"
                    style={{
                      background: 'oklch(0.73 0.12 78)',
                      boxShadow: '0 0 6px oklch(0.73 0.12 78 / 0.9)',
                    }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Gold divider */}
        <div
          className="mx-5 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.25), transparent)' }}
        />

        {/* Footer */}
        <div className="px-3 py-4">
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.98]"
            style={{ color: 'oklch(0.40 0.005 75)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'oklch(0.65 0.18 25)'
              e.currentTarget.style.background = 'oklch(0.65 0.18 25 / 0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'oklch(0.40 0.005 75)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="text-sm">ログアウト</span>
          </Link>
        </div>
      </aside>
    </>
  )
}
