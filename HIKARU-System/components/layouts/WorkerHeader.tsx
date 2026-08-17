'use client'

import * as React from 'react'
import { ArrowLeft, Menu } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@hikaru/ui'
import { useMenuContext } from './WorkerLayout'

interface WorkerHeaderProps {
  title: string
  showBack?: boolean
  rightAction?: React.ReactNode
  className?: string
}

export function WorkerHeader({ title, showBack = false, rightAction, className }: WorkerHeaderProps) {
  const router = useRouter()
  const { openMenu } = useMenuContext()

  return (
    <header
      className={cn(
        'sticky top-[var(--header-height)] z-[40]',
        'flex items-center h-[var(--header-height)] px-4 gap-3 relative',
        className
      )}
      style={{
        background: 'oklch(0.05 0.002 260 / 0.94)',
        backdropFilter: 'blur(30px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
        borderBottom: '1px solid oklch(0.73 0.12 78 / 0.18)',
      }}
    >
      {/* Bottom gold glow */}
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.28), transparent)' }}
      />

      {showBack ? (
        <button
          onClick={() => router.back()}
          aria-label="戻る"
          className="rounded-full p-2 -ml-1 transition-all duration-150 active:scale-90 focus:outline-none"
          style={{ color: 'oklch(0.55 0.007 75)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
            e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'oklch(0.55 0.007 75)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : (
        <button
          onClick={openMenu}
          aria-label="メニューを開く"
          className="rounded-full p-2 -ml-1 transition-all duration-150 active:scale-90 focus:outline-none"
          style={{ color: 'oklch(0.55 0.007 75)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
            e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'oklch(0.55 0.007 75)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* HIKARU logo badge */}
      {!showBack && (
        <span
          className="text-[9px] font-black tracking-[0.3em] uppercase"
          style={{
            background: 'linear-gradient(90deg, oklch(0.62 0.11 75), oklch(0.82 0.13 78))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          HIKARU
        </span>
      )}

      <h1 className="flex-1 text-base font-semibold truncate" style={{ color: 'oklch(0.92 0.008 75)' }}>
        {title}
      </h1>
      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </header>
  )
}
