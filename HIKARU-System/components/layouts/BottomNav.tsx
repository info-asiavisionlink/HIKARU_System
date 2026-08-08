'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Briefcase, Calendar, Bell, User } from 'lucide-react'
import { cn } from '@hikaru/ui'

const navItems = [
  { label: 'ホーム',       href: '/home',         icon: Home },
  { label: '案件',         href: '/jobs',          icon: Briefcase },
  { label: 'スケジュール', href: '/schedule',      icon: Calendar },
  { label: '通知',         href: '/notifications', icon: Bell },
  { label: 'プロフィール', href: '/profile',       icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] flex items-center justify-around px-2"
      style={{
        height: 'var(--bottom-nav-height)',
        background: 'oklch(0.05 0.002 260 / 0.94)',
        backdropFilter: 'blur(30px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
        borderTop: '1px solid oklch(0.73 0.12 78 / 0.18)',
        boxShadow: '0 -1px 0 oklch(0.73 0.12 78 / 0.05)',
      }}
    >
      {/* Gold top glow */}
      <div className="absolute top-0 left-1/4 right-1/4 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.35), transparent)' }}
      />

      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-[var(--radius)] py-1.5 px-2 relative transition-all duration-200 active:scale-90"
            style={{ color: isActive ? 'oklch(0.82 0.13 78)' : 'oklch(0.45 0.006 75)' }}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute top-0 w-8 h-0.5 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, oklch(0.62 0.11 75), oklch(0.88 0.13 78), oklch(0.73 0.12 78))',
                  boxShadow: '0 0 8px oklch(0.73 0.12 78 / 0.80)',
                }}
              />
            )}
            <Icon
              className={cn('h-5 w-5 transition-all duration-200', isActive && 'scale-110')}
              style={isActive ? { filter: 'drop-shadow(0 0 5px oklch(0.73 0.12 78 / 0.80))' } : {}}
            />
            <span className="text-[10px] font-medium tracking-wide">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
