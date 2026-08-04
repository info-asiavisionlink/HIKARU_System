import * as React from 'react'
import { cn } from '@hikaru/ui'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 text-center',
      className
    )}>
      {icon && (
        <div className="mb-4 text-[var(--color-muted-foreground)] opacity-40">
          {icon}
        </div>
      )}
      <p className="text-base font-medium text-[var(--color-foreground)]">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
