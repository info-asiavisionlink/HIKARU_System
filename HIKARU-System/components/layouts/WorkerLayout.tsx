'use client'

import * as React from 'react'
import { BottomNav } from './BottomNav'
import { Toaster } from '@hikaru/ui'

interface WorkerLayoutProps {
  children: React.ReactNode
  hideBottomNav?: boolean
}

export function WorkerLayout({ children, hideBottomNav = false }: WorkerLayoutProps) {
  return (
    <>
      <main className="min-h-dvh pb-[var(--bottom-nav-height)]">
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
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
    </>
  )
}
