'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Briefcase, Calendar, Bell, User, X, LogOut, Link2, ClockArrowUp, TrendingUp, Zap, RefreshCw, Hotel, Receipt } from 'lucide-react'
import { cn } from '@hikaru/ui'

const GOLD = 'oklch(0.73 0.12 78)'

type NavChild = { label: string; href: string }
type NavItem  = { label: string; href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: 'ホーム',       href: '/home',          icon: Home },
  { label: '案件',         href: '/jobs',           icon: Briefcase },
  { label: 'スケジュール', href: '/schedule',       icon: Calendar },
  {
    label: '勤怠管理',
    href: '/attendance',
    icon: ClockArrowUp,
    children: [
      { label: '修正申請', href: '/attendance/corrections' },
    ],
  },
  { label: '経費申請',     href: '/expenses',       icon: Receipt },
  {
    label: '営業成績',
    href: '/sales',
    icon: TrendingUp,
    children: [
      { label: '単発案件', href: '/sales/new/spot' },
      { label: '定期案件', href: '/sales/new/recurring' },
      { label: 'ホテル案件', href: '/sales/new/hotel' },
    ],
  },
  { label: '通知',         href: '/notifications',  icon: Bell },
  { label: 'Google連携',   href: '/google',         icon: Link2 },
  { label: 'プロフィール', href: '/profile',        icon: User },
]

interface WorkerSidebarProps {
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export function WorkerSidebar({ mobileOpen = false, onMobileClose }: WorkerSidebarProps) {
  const pathname = usePathname()

  React.useEffect(() => {
    onMobileClose?.()
  }, [pathname]) // eslint-disable-line

  function isGroupActive(item: NavItem) {
    return pathname.startsWith(item.href)
  }

  function isChildActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const sidebar = (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-[var(--z-sticky)] flex flex-col',
        'transition-all duration-300',
        'md:translate-x-0 md:w-[var(--sidebar-width)]',
        'w-[var(--sidebar-width)]',
        mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{
        background: 'oklch(0.04 0.002 260)',
        borderRight: `1px solid ${GOLD}26`,
      }}
    >
      {/* ロゴエリア */}
      <div
        className="flex items-center gap-3 h-[var(--header-height)] px-4 shrink-0"
        style={{ borderBottom: `1px solid ${GOLD}1f` }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] shrink-0"
          style={{
            background: `linear-gradient(135deg, oklch(0.52 0.10 75), oklch(0.73 0.12 78), oklch(0.88 0.13 78))`,
            boxShadow: `0 0 16px ${GOLD}80`,
          }}
        >
          <span className="text-sm font-black" style={{ color: 'oklch(0.06 0.003 260)', letterSpacing: '-0.02em' }}>H</span>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span
            className="text-sm font-black tracking-[0.15em] uppercase"
            style={{
              background: `linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), ${GOLD})`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}
          >
            HIKARU
          </span>
          <span className="text-[8px] tracking-[0.25em] uppercase" style={{ color: `${GOLD}80` }}>
            Worker
          </span>
        </div>
        {/* モバイル: 閉じるボタン */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-[var(--radius)] transition-colors"
          style={{ color: `${GOLD}80` }}
          aria-label="メニューを閉じる"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <p className="px-4 mb-2 text-[8px] font-bold uppercase tracking-[0.3em]" style={{ color: `${GOLD}59` }}>
          Navigation
        </p>
        <ul className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => {
            const groupActive = isGroupActive(item)
            const Icon = item.icon

            if (item.children) {
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200"
                    style={groupActive ? {
                      background: `linear-gradient(90deg, ${GOLD}1f, transparent)`,
                      color: 'oklch(0.82 0.13 78)',
                      borderLeft: `2px solid ${GOLD}cc`,
                      marginLeft: -2,
                    } : { color: 'oklch(0.55 0.008 75)' }}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={groupActive ? { filter: `drop-shadow(0 0 4px ${GOLD}cc)` } : {}} />
                    <span className="truncate">{item.label}</span>
                    {groupActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full"
                        style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
                    )}
                  </Link>
                  <ul className="ml-7 mt-0.5 flex flex-col gap-0.5 border-l pl-3"
                    style={{ borderColor: `${GOLD}22` }}>
                    {item.children.map((child) => {
                      const childActive = isChildActive(child.href)
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block rounded-[var(--radius)] px-3 py-1.5 text-xs font-medium transition-all duration-150"
                            style={childActive ? {
                              background: `${GOLD}18`,
                              color: 'oklch(0.82 0.13 78)',
                            } : { color: 'oklch(0.50 0.007 75)' }}
                          >
                            {child.label}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              )
            }

            const isActive = pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200 relative"
                  style={isActive ? {
                    background: `linear-gradient(90deg, ${GOLD}1f, transparent)`,
                    color: 'oklch(0.82 0.13 78)',
                    borderLeft: `2px solid ${GOLD}cc`,
                    marginLeft: -2,
                  } : { color: 'oklch(0.55 0.008 75)' }}
                >
                  <Icon
                    className="h-4 w-4 shrink-0"
                    style={isActive ? { filter: `drop-shadow(0 0 4px ${GOLD}cc)` } : {}}
                  />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <span
                      className="absolute right-2.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 下部: ログアウト */}
      <div className="py-3 px-2" style={{ borderTop: `1px solid ${GOLD}1a` }}>
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200"
          style={{ color: 'oklch(0.40 0.005 75)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'oklch(0.65 0.18 25)'; e.currentTarget.style.background = 'oklch(0.65 0.18 25 / 0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'oklch(0.40 0.005 75)'; e.currentTarget.style.background = 'transparent' }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>ログアウト</span>
        </Link>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}59, transparent)` }}
      />
    </aside>
  )

  return (
    <>
      {sidebar}
      {/* モバイル: 背景オーバーレイ */}
      {mobileOpen && (
        <div
          className="fixed inset-0 md:hidden"
          style={{ zIndex: 'calc(var(--z-sticky) - 1)', background: 'oklch(0 0 0 / 0.6)' }}
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
    </>
  )
}
