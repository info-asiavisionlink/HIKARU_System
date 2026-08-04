import * as React from 'react'
import { cn } from '../lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'text' | 'circular' | 'card'
}

function Skeleton({ className, variant = 'default', ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-[shimmer_2s_ease-in-out_infinite]',
        'bg-[length:200%_100%]',
        'border',
        variant === 'circular' ? 'rounded-full' : 'rounded-[var(--radius)]',
        variant === 'text' && 'h-4 w-full',
        variant === 'card' && 'h-40 w-full',
        className
      )}
      style={{
        backgroundImage: 'linear-gradient(90deg, oklch(0.10 0.006 255/0.5) 0%, oklch(0.73 0.12 78/0.10) 50%, oklch(0.10 0.006 255/0.5) 100%)',
        borderColor: 'oklch(0.73 0.12 78 / 0.12)',
      }}
      aria-hidden="true"
      {...props}
    />
  )
}

function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" style={{ width: i === lines - 1 ? '65%' : '100%' }} />
      ))}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-[var(--radius-lg)] p-5"
      style={{
        background: 'oklch(0.09 0.005 255 / 0.80)',
        border: '1px solid oklch(0.73 0.12 78 / 0.12)',
      }}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonCard }
