import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { AlertCircle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

const alertVariants = cva(
  'relative flex gap-3 rounded-[var(--radius-lg)] border p-4 text-sm',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--color-muted)] border-[var(--color-border)] text-[var(--color-foreground)]',
        info:
          'bg-[var(--color-info-muted)] border-[var(--color-info)]/30 text-[var(--color-info-foreground)]',
        success:
          'bg-[var(--color-success-muted)] border-[var(--color-success)]/30 text-[var(--color-success-foreground)]',
        warning:
          'bg-[var(--color-warning-muted)] border-[var(--color-warning)]/30 text-[var(--color-warning-foreground)]',
        error:
          'bg-[var(--color-error-muted)] border-[var(--color-error)]/30 text-[var(--color-error-foreground)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const alertIcons = {
  default: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
}

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string
  showIcon?: boolean
}

function Alert({ className, variant = 'default', title, children, showIcon = true, ...props }: AlertProps) {
  const Icon = alertIcons[variant ?? 'default']
  return (
    <div className={cn(alertVariants({ variant, className }))} role="alert" {...props}>
      {showIcon && <Icon className="h-4 w-4 mt-0.5 shrink-0" />}
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && (
          <div className={cn('leading-normal', title && 'opacity-90 text-xs')}>
            {children}
          </div>
        )}
      </div>
    </div>
  )
}

export { Alert, alertVariants }
