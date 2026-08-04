import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-[var(--radius-full)] font-medium transition-all duration-200 tracking-wide',
  {
    variants: {
      variant: {
        default:
          'bg-[oklch(0.73_0.12_78/0.12)] text-[oklch(0.82_0.13_78)] border border-[oklch(0.73_0.12_78/0.40)] shadow-[0_0_10px_oklch(0.73_0.12_78/0.20)]',
        secondary:
          'bg-[oklch(0.12_0.007_255/0.80)] text-[oklch(0.60_0.010_75)] border border-[oklch(0.73_0.12_78/0.15)]',
        success:
          'bg-[oklch(0.72_0.18_150/0.12)] text-[oklch(0.72_0.18_150)] border border-[oklch(0.72_0.18_150/0.40)] shadow-[0_0_10px_oklch(0.72_0.18_150/0.20)]',
        warning:
          'bg-[oklch(0.78_0.18_75/0.12)] text-[oklch(0.78_0.18_75)] border border-[oklch(0.78_0.18_75/0.35)]',
        error:
          'bg-[oklch(0.65_0.25_27/0.12)] text-[oklch(0.65_0.25_27)] border border-[oklch(0.65_0.25_27/0.40)] shadow-[0_0_10px_oklch(0.65_0.25_27/0.20)]',
        info:
          'bg-[oklch(0.68_0.20_230/0.12)] text-[oklch(0.68_0.20_230)] border border-[oklch(0.68_0.20_230/0.40)]',
        outline:
          'border border-[oklch(0.73_0.12_78/0.35)] text-[oklch(0.88_0.008_75)]',
        neon:
          'bg-[oklch(0.85_0.18_198/0.12)] text-[oklch(0.85_0.18_198)] border border-[oklch(0.85_0.18_198/0.40)] shadow-[0_0_10px_oklch(0.85_0.18_198/0.20)]',
      },
      size: {
        sm:      'px-2    py-0.5 text-[10px]',
        default: 'px-2.5 py-0.5 text-xs',
        lg:      'px-3   py-1   text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props} />
  )
}

export { Badge, badgeVariants }
