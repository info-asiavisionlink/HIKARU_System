'use client'

import * as React from 'react'
import Link from 'next/link'
import { Menu, Bell, Cpu } from 'lucide-react'
import { cn } from '@hikaru/ui'

const GOLD = 'oklch(0.73 0.12 78)'

interface WorkerTopBarProps {
  onMobileMenuClick?: () => void
}

export function WorkerTopBar({ onMobileMenuClick }: WorkerTopBarProps) {
  const [time, setTime] = React.useState('')

  React.useEffect(() => {
    const update = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
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
        'h-[var(--header-height)] px-4',
        'left-0 md:left-[var(--sidebar-width)]',
      )}
      style={{
        background: 'oklch(0.05 0.002 260 / 0.92)',
        backdropFilter: 'blur(24px) saturate(1.5)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
        borderBottom: `1px solid ${GOLD}22`,
      }}
    >
      {/* 左: モバイルのみハンバーガー */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuClick}
          className="md:hidden p-2 rounded-[var(--radius)] transition-all"
          style={{ color: `${GOLD}99` }}
          aria-label="メニューを開く"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* AI ENGINE インジケーター（デスクトップのみ） */}
        <div className="hidden md:flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5" style={{ color: `${GOLD}80` }} />
          <span className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: `${GOLD}80` }}>
            AI ENGINE
          </span>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'oklch(0.72 0.18 150)', boxShadow: '0 0 6px oklch(0.72 0.18 150)' }} />
            <span className="text-[9px] tabular-nums" style={{ color: 'oklch(0.72 0.18 150 / 0.8)' }}>{time}</span>
          </div>
        </div>
      </div>

      {/* 右: 通知ベル */}
      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className="relative flex items-center justify-center h-8 w-8 rounded-[var(--radius)] transition-all"
          style={{ color: `${GOLD}80` }}
          onMouseEnter={(e) => { e.currentTarget.style.background = `${GOLD}12`; e.currentTarget.style.color = GOLD }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = `${GOLD}80` }}
        >
          <Bell className="h-4 w-4" />
        </Link>
      </div>

      {/* ゴールドボトムグロー */}
      <div
        className="absolute bottom-0 left-1/4 right-1/4 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${GOLD}33, transparent)` }}
      />
    </header>
  )
}
