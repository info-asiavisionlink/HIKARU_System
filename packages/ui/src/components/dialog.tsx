'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[var(--z-overlay)]',
      'data-[state=open]:animate-[fade-in_0.22s_ease-out]',
      'data-[state=closed]:animate-[fade-out_0.15s_ease-in]',
      className
    )}
    style={{ background: 'oklch(0 0 0 / 0.80)', backdropFilter: 'blur(8px)' }}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showClose?: boolean }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    {/*
      fixed inset-0 + flex centering：
      position:fixed + left/top + translate(-50%) はbackdrop-filter祖先に
      よってcontaining blockがずれるブラウザバグがあるため、
      オーバーレイと同じ fixed inset-0 ラッパーの中で flexbox センタリングする
    */}
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4"
      style={{ pointerEvents: 'none' }}
    >
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'w-full max-w-md',
          'rounded-[var(--radius-xl)]',
          'data-[state=open]:animate-[dialog-zoom-in_0.22s_ease-out]',
          'data-[state=closed]:animate-[dialog-zoom-out_0.15s_ease-in]',
          'focus:outline-none',
          'relative overflow-hidden',
          className
        )}
        style={{
          pointerEvents: 'auto',
          background: 'oklch(0.10 0.006 255)',
          border: '1px solid oklch(0.73 0.12 78 / 0.30)',
          boxShadow: '0 30px 80px oklch(0 0 0 / 0.70), 0 0 60px oklch(0.73 0.12 78 / 0.08)',
        }}
        {...props}
      >
        {/* Gold top line */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, oklch(0.73 0.12 78 / 0.60), transparent)' }}
        />
        {children}
        {showClose && (
          <DialogPrimitive.Close
            className="absolute right-4 top-4 rounded-[var(--radius-sm)] p-1.5 transition-all duration-200 focus:outline-none"
            style={{ color: 'oklch(0.50 0.008 60)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'oklch(0.73 0.12 78)'
              e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'oklch(0.50 0.008 60)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">閉じる</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pt-6 pb-2 flex flex-col gap-1', className)} {...props} />
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold tracking-wide', className)}
    style={{ color: 'oklch(0.95 0.008 75)' }}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm', className)}
    style={{ color: 'oklch(0.55 0.010 75)' }}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-4', className)} {...props} />
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-6 pb-6 pt-2 flex items-center justify-end gap-3 mt-2', className)}
      style={{ borderTop: '1px solid oklch(0.73 0.12 78 / 0.12)' }}
      {...props}
    />
  )
}

export {
  Dialog, DialogPortal, DialogOverlay, DialogClose, DialogTrigger,
  DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter,
}
