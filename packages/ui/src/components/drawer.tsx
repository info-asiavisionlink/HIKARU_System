'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

interface DrawerProps {
  open: boolean
  onClose: () => void
  side?: 'left' | 'right' | 'bottom'
  title?: string
  children: React.ReactNode
  className?: string
}

function Drawer({ open, onClose, side = 'right', title, children, className }: DrawerProps) {
  React.useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  const slideClass = {
    right:  'right-0 top-0 h-full w-full max-w-sm animate-[slide-in-right_0.25s_cubic-bezier(0.16,1,0.3,1)]',
    left:   'left-0  top-0 h-full w-full max-w-sm animate-[slide-in-left_0.25s_cubic-bezier(0.16,1,0.3,1)]',
    bottom: 'bottom-0 left-0 w-full rounded-t-[var(--radius-2xl)] animate-[slide-up_0.25s_cubic-bezier(0.16,1,0.3,1)]',
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm animate-[fade-in_0.15s_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute flex flex-col',
          'bg-[var(--color-surface)] shadow-[var(--shadow-xl)]',
          slideClass[side],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          {title && (
            <h2 className="text-base font-semibold text-[var(--color-foreground)]">{title}</h2>
          )}
          <button
            onClick={onClose}
            className={cn(
              'ml-auto rounded-[var(--radius-sm)] p-1.5',
              'text-[var(--color-muted-foreground)]',
              'transition-colors duration-150',
              'hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2'
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  )
}

export { Drawer }
