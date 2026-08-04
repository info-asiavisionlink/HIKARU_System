import * as React from 'react'
import { cn } from '../lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  clickable?: boolean
  glow?: 'gold' | 'cyan' | 'blue' | 'none'
  variant?: 'default' | 'gold' | 'neon' | 'glass'
}

function Card({ className, hoverable, clickable, glow = 'none', variant = 'default', ...props }: CardProps) {
  const glowStyles = {
    gold: { boxShadow: '0 0 20px oklch(0.73 0.12 78 / 0.30), 0 0 60px oklch(0.73 0.12 78 / 0.10)' },
    cyan: { boxShadow: '0 0 20px oklch(0.85 0.18 198 / 0.30), 0 0 60px oklch(0.85 0.18 198 / 0.10)' },
    blue: { boxShadow: '0 0 20px oklch(0.60 0.28 260 / 0.30), 0 0 60px oklch(0.60 0.28 260 / 0.10)' },
    none: {},
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    default: {
      background:  'oklch(0.09 0.005 255 / 0.80)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      border: '1px solid oklch(0.73 0.12 78 / 0.18)',
    },
    gold: {
      background: 'oklch(0.10 0.006 255 / 0.82)',
      backdropFilter: 'blur(24px) saturate(1.5)',
      border: '1px solid oklch(0.73 0.12 78 / 0.35)',
      boxShadow: '0 0 30px oklch(0.73 0.12 78 / 0.08), inset 0 1px 0 oklch(0.85 0.13 78 / 0.12)',
    },
    neon: {
      background: 'oklch(0.09 0.005 255 / 0.80)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      border: '1px solid oklch(0.85 0.18 198 / 0.30)',
      boxShadow: '0 0 20px oklch(0.85 0.18 198 / 0.08)',
    },
    glass: {
      background: 'oklch(0.12 0.007 255 / 0.60)',
      backdropFilter: 'blur(40px) saturate(1.8)',
      border: '1px solid oklch(1 0 0 / 0.08)',
    },
  }

  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)]',
        'transition-all duration-300',
        hoverable && 'hover:-translate-y-0.5 hover:border-[oklch(0.73_0.12_78/0.40)]',
        clickable && 'cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]',
        className
      )}
      style={{
        ...variantStyles[variant],
        ...(glow !== 'none' ? glowStyles[glow] : {}),
      }}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pt-5 pb-0 flex flex-col gap-1', className)} {...props} />
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('text-base font-semibold leading-tight tracking-wide', className)}
      style={{ color: 'oklch(0.95 0.008 75)' }}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm', className)}
      style={{ color: 'oklch(0.60 0.010 75)' }}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...props} />
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('px-5 pb-5 pt-0 flex items-center gap-3', className)}
      {...props}
    />
  )
}

function CardDivider({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn('mx-5', className)}
      style={{ borderColor: 'oklch(0.73 0.12 78 / 0.12)' }}
      {...props}
    />
  )
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardDivider }
