'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-medium select-none cursor-pointer',
    'rounded-[var(--radius)]',
    'transition-all duration-300',
    'focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-30',
    'active:scale-[0.97]',
    'tracking-wide',
  ].join(' '),
  {
    variants: {
      variant: {
        /* ゴールド — プライマリCTA */
        default:
          'text-[oklch(0.08_0.005_60)] font-semibold',
        /* ゴールドアウトライン */
        outline:
          'text-[oklch(0.73_0.12_78)]',
        /* ダークグラス */
        secondary:
          'text-[oklch(0.88_0.008_75)]',
        /* ゴースト */
        ghost:
          'text-[oklch(0.88_0.008_75)]',
        /* ネオンシアン — AI/インタラクション */
        neon:
          'text-[oklch(0.05_0.003_260)]',
        /* 削除/危険 */
        destructive:
          'text-[oklch(0.65_0.25_27)]',
        /* 成功 */
        success:
          'text-[oklch(0.72_0.18_150)]',
        /* リンク */
        link:
          'text-[oklch(0.73_0.12_78)] underline-offset-4 hover:underline h-auto p-0',
      },
      size: {
        xs:        'h-7  px-2.5 text-xs  gap-1',
        sm:        'h-8  px-3   text-sm  gap-1.5',
        default:   'h-10 px-4   text-sm',
        lg:        'h-11 px-5   text-sm',
        xl:        'h-13 px-7   text-base',
        icon:      'h-10 w-10',
        'icon-sm': 'h-8  w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

// variant別のinlineスタイル
const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    background: 'linear-gradient(135deg, oklch(0.62 0.11 75) 0%, oklch(0.82 0.13 78) 45%, oklch(0.90 0.10 80) 60%, oklch(0.73 0.12 78) 100%)',
    boxShadow: '0 0 16px oklch(0.73 0.12 78 / 0.45), 0 2px 8px oklch(0 0 0 / 0.5)',
  },
  outline: {
    background: 'oklch(0.73 0.12 78 / 0.08)',
    border: '1px solid oklch(0.73 0.12 78 / 0.50)',
    boxShadow: '0 0 12px oklch(0.73 0.12 78 / 0.20)',
  },
  secondary: {
    background: 'oklch(0.12 0.007 255 / 0.85)',
    border: '1px solid oklch(0.73 0.12 78 / 0.18)',
    backdropFilter: 'blur(16px)',
  },
  ghost: {
    background: 'transparent',
  },
  neon: {
    background: 'oklch(0.85 0.18 198)',
    boxShadow: '0 0 16px oklch(0.85 0.18 198 / 0.55), 0 0 40px oklch(0.85 0.18 198 / 0.20)',
  },
  destructive: {
    background: 'oklch(0.65 0.25 27 / 0.12)',
    border: '1px solid oklch(0.65 0.25 27 / 0.45)',
    boxShadow: '0 0 12px oklch(0.65 0.25 27 / 0.20)',
  },
  success: {
    background: 'oklch(0.72 0.18 150 / 0.12)',
    border: '1px solid oklch(0.72 0.18 150 / 0.45)',
    boxShadow: '0 0 12px oklch(0.72 0.18 150 / 0.20)',
  },
  link: {},
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size, asChild = false, loading, disabled, style, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        style={{ ...variantStyles[variant ?? 'default'], ...style }}
        {...props}
      >
        {loading && (
          <span
            className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-[spin_0.7s_linear_infinite]"
            aria-hidden="true"
          />
        )}
        {children}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
