'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, FolderOpen, Building2, UserCheck, HandshakeIcon,
  BookOpen, BarChart3, Settings, ChevronLeft, ChevronRight,
  Bell, FileText, Zap, Hotel, RefreshCw,
} from 'lucide-react'
import { cn } from '@hikaru/ui'

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

interface NavChild { label: string; href: string }
interface NavItem  { label: string; href: string; icon: IconComponent; badge?: number; children?: NavChild[] }

const navItems: NavItem[] = [
  { label: 'ダッシュボード',   href: '/dashboard',    icon: LayoutDashboard },
  {
    label: '案件管理',
    href: '/projects',
    icon: FolderOpen,
    children: [
      { label: '全案件',       href: '/projects' },
      { label: '単発案件',     href: '/projects/spot' },
      { label: '定期案件',     href: '/projects/recurring' },
      { label: 'ホテル案件',   href: '/projects/hotel' },
    ],
  },
  { label: '顧客管理',         href: '/clients',       icon: Building2 },
  { label: '従業員管理',       href: '/employees',     icon: UserCheck },
  { label: '協力業者管理',     href: '/partners',      icon: HandshakeIcon },
  { label: 'マニュアル管理',   href: '/manuals',       icon: BookOpen },
  { label: '報告書管理',       href: '/reports',       icon: FileText },
  { label: '通知管理',         href: '/notifications', icon: Bell },
  { label: 'AI分析',           href: '/analytics',     icon: BarChart3 },
]

const GOLD = 'oklch(0.73 0.12 78)'

interface SidebarProps { collapsed?: boolean; onToggleCollapse?: () => void }

export function Sidebar({ collapsed = false, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname()

  function isGroupActive(item: NavItem) {
    if (item.children) return pathname.startsWith(item.href)
    return pathname.startsWith(item.href)
  }

  function isChildActive(href: string) {
    if (href === '/projects') return pathname === '/projects' || pathname === '/projects/'
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-[var(--z-sticky)]',
        'flex flex-col transition-all duration-350',
        collapsed ? 'w-[var(--sidebar-collapsed-width)]' : 'w-[var(--sidebar-width)]'
      )}
      style={{
        background: 'oklch(0.04 0.002 260)',
        borderRight: `1px solid ${GOLD}26`,
      }}
    >
      {/* ロゴエリア */}
      <div
        className={cn('flex items-center h-[var(--header-height)] px-4 shrink-0', !collapsed && 'gap-3')}
        style={{ borderBottom: `1px solid ${GOLD}1f` }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-[var(--radius)] shrink-0"
          style={{
            background: 'linear-gradient(135deg, oklch(0.52 0.10 75) 0%, oklch(0.73 0.12 78) 50%, oklch(0.88 0.13 78) 100%)',
            boxShadow: `0 0 16px ${GOLD}80`,
          }}
        >
          <span className="text-sm font-black" style={{ color: 'oklch(0.06 0.003 260)', letterSpacing: '-0.02em' }}>H</span>
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-black tracking-[0.15em] uppercase"
              style={{
                background: `linear-gradient(135deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), ${GOLD})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>
              HIKARU
            </span>
            <span className="text-[8px] tracking-[0.25em] uppercase" style={{ color: `${GOLD}80` }}>AI Platform</span>
          </div>
        )}
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-4 mb-2 text-[8px] font-bold uppercase tracking-[0.3em]" style={{ color: `${GOLD}59` }}>
            Navigation
          </p>
        )}
        <ul className="flex flex-col gap-0.5 px-2">
          {navItems.map((item) => {
            const groupActive = isGroupActive(item)
            const Icon = item.icon

            if (item.children && !collapsed) {
              return (
                <li key={item.href}>
                  {/* 親リンク */}
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

                  {/* 子メニュー（常に表示） */}
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

            // 通常アイテム（または折りたたみ時）
            const isActive = item.children
              ? pathname.startsWith(item.href)
              : pathname.startsWith(item.href)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5',
                    'text-sm font-medium transition-all duration-200 relative group',
                    collapsed && 'justify-center px-2'
                  )}
                  style={isActive ? {
                    background: `linear-gradient(90deg, ${GOLD}1f, transparent)`,
                    color: 'oklch(0.82 0.13 78)',
                    borderLeft: collapsed ? 'none' : `2px solid ${GOLD}cc`,
                    marginLeft: collapsed ? 0 : -2,
                  } : { color: 'oklch(0.55 0.008 75)' }}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" style={isActive ? { filter: `drop-shadow(0 0 4px ${GOLD}cc)` } : {}} />
                  {!collapsed && (
                    <>
                      <span className="truncate">{item.label}</span>
                      {item.badge != null && (
                        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                          style={{ background: GOLD, color: 'oklch(0.06 0.003 260)', boxShadow: `0 0 8px ${GOLD}99` }}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {isActive && !collapsed && (
                    <span className="absolute right-2.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: GOLD, boxShadow: `0 0 6px ${GOLD}` }} />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 下部エリア */}
      <div className="py-3 flex flex-col gap-0.5 px-2" style={{ borderTop: `1px solid ${GOLD}1a` }}>
        <Link
          href="/settings"
          className={cn('flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200', collapsed && 'justify-center px-2')}
          style={pathname.startsWith('/settings') ? { color: 'oklch(0.82 0.13 78)', background: `${GOLD}1a` } : { color: 'oklch(0.50 0.007 75)' }}
          title={collapsed ? '設定' : undefined}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>設定</span>}
        </Link>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn('flex items-center gap-3 rounded-[var(--radius)] px-3 py-2.5 text-sm font-medium transition-all duration-200', collapsed && 'justify-center px-2')}
            style={{ color: 'oklch(0.40 0.005 75)' }}
          >
            {collapsed
              ? <ChevronRight className="h-4 w-4 shrink-0" />
              : <><ChevronLeft className="h-4 w-4 shrink-0" /><span className="text-xs">折り畳む</span></>
            }
          </button>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}59, transparent)` }} />
    </aside>
  )
}
