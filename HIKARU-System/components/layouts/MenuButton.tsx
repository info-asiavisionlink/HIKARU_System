'use client'

import * as React from 'react'
import { Menu } from 'lucide-react'
import { useMenuContext } from './WorkerLayout'

export function MenuButton({ className }: { className?: string }) {
  const { openMenu } = useMenuContext()
  return (
    <button
      onClick={openMenu}
      aria-label="メニューを開く"
      className={`rounded-full p-2 transition-all duration-150 active:scale-90 focus:outline-none ${className ?? ''}`}
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
  )
}
