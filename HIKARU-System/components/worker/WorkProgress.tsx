import * as React from 'react'
import { cn } from '@hikaru/ui'
import { Check, Camera } from 'lucide-react'

interface WorkProgressProps {
  total: number
  completed: number
  label?: string
  className?: string
}

export function WorkProgress({ total, completed, label, className }: WorkProgressProps) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <span className="text-sm font-medium text-[var(--color-foreground)]">
            {label ?? '撮影進捗'}
          </span>
        </div>
        <span className="text-sm font-semibold text-[var(--color-foreground)]">
          {completed} / {total}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            percent === 100
              ? 'bg-[var(--color-success)]'
              : 'bg-[var(--color-primary)]'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {percent === 100 ? '撮影完了' : `残り ${total - completed}件`}
        </span>
        <span className={cn(
          'text-xs font-semibold',
          percent === 100 ? 'text-[var(--color-success)]' : 'text-[var(--color-primary)]'
        )}>
          {percent}%
        </span>
      </div>
    </div>
  )
}

interface SpotStatusDotProps {
  hasBefore: boolean
  hasAfter: boolean
  required?: boolean
}

export function SpotStatusDot({ hasBefore, hasAfter, required = true }: SpotStatusDotProps) {
  if (hasAfter) return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-success)] shrink-0">
      <Check className="h-3.5 w-3.5 text-white" />
    </span>
  )
  if (hasBefore) return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] shrink-0">
      <Camera className="h-3.5 w-3.5 text-white" />
    </span>
  )
  return (
    <span className={cn(
      'flex h-6 w-6 items-center justify-center rounded-full shrink-0',
      required
        ? 'bg-[var(--color-error-muted)] border border-[var(--color-error)]/30'
        : 'bg-[var(--color-muted)] border border-[var(--color-border)]'
    )}>
      <Camera className={cn('h-3.5 w-3.5', required ? 'text-[var(--color-error)]' : 'text-[var(--color-muted-foreground)]')} />
    </span>
  )
}
