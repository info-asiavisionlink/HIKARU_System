'use client'

import * as React from 'react'
import { Bell, Cpu } from 'lucide-react'
import {
  Avatar, AvatarFallback, AvatarImage,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  cn,
} from '@hikaru/ui'
import { useAuthStore } from '@/stores/auth.store'
import { useAuth } from '@/hooks/useAuth'

interface ConsoleHeaderProps {
  sidebarWidth?: string
}

export function ConsoleHeader({ sidebarWidth = 'var(--sidebar-width)' }: ConsoleHeaderProps) {
  const user = useAuthStore((s) => s.user)
  const { logout } = useAuth()
  const [time, setTime] = React.useState('')
  const [date, setDate] = React.useState('')

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDate(now.toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-[var(--z-sticky)]',
        'flex items-center justify-between gap-4',
        'h-[var(--header-height)] px-5',
        'transition-all duration-300'
      )}
      style={{
        left: sidebarWidth,
        background: 'oklch(0.05 0.002 260 / 0.92)',
        backdropFilter: 'blur(30px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
        borderBottom: '1px solid oklch(0.73 0.12 78 / 0.15)',
      }}
    >
      {/* Gold top glow */}
      <div className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.50), transparent)' }}
      />

      {/* 左: システム情報 */}
      <div className="flex items-center gap-5">
        {/* AI Engine status */}
        <div className="flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" style={{ color: 'oklch(0.85 0.18 198 / 0.7)' }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]"
            style={{ color: 'oklch(0.85 0.18 198 / 0.60)' }}>
            AI ENGINE
          </span>
          <span className="h-1.5 w-1.5 rounded-full animate-[pulse-soft_2s_ease-in-out_infinite]"
            style={{ background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150)' }} />
        </div>

        {/* 日時 */}
        <div className="hidden sm:flex items-center gap-2">
          <span className="text-[10px] font-mono tracking-wider"
            style={{ color: 'oklch(0.50 0.007 75)' }}>
            {date}
          </span>
          <span className="text-xs font-mono tracking-widest"
            style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
            {time}
          </span>
        </div>
      </div>

      {/* 右: アクション */}
      <div className="flex items-center gap-2">
        {/* 通知 */}
        <button
          className="relative rounded-[var(--radius)] p-2 transition-all duration-200 focus:outline-none"
          style={{ color: 'oklch(0.50 0.007 75)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
            e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'oklch(0.50 0.007 75)'
            e.currentTarget.style.background = 'transparent'
          }}
          aria-label="通知"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Divider */}
        <div className="h-5 w-px" style={{ background: 'oklch(0.73 0.12 78 / 0.15)' }} />

        {/* ユーザーメニュー */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 rounded-[var(--radius)] px-2.5 py-1.5 transition-all duration-200 focus:outline-none"
              onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.06)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <Avatar size="sm">
                <AvatarImage src={undefined} alt={user?.name} />
                <AvatarFallback>{user?.name?.slice(0, 2) ?? 'AD'}</AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start min-w-0">
                <span className="text-xs font-semibold truncate max-w-[120px]"
                  style={{ color: 'oklch(0.88 0.008 75)' }}>
                  {user?.name ?? '管理者'}
                </span>
                <span className="text-[9px] uppercase tracking-[0.2em]"
                  style={{ color: 'oklch(0.73 0.12 78 / 0.65)' }}>
                  ADMIN
                </span>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{user?.email ?? 'admin@hikaru.com'}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>プロフィール</DropdownMenuItem>
            <DropdownMenuItem>設定</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={logout}>ログアウト</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
