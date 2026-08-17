import * as React from 'react'
import { cn } from '../lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
  className?: string
  brand?: string
}

function PageHeader({ title, description, actions, breadcrumb, className, brand = 'HIKARU CONSOLE' }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 mb-7', className)}>
      {breadcrumb}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Gold accent mark */}
          <div className="flex items-center gap-2.5">
            <div className="flex gap-0.5">
              <div className="h-3 w-0.5 rounded-full"
                style={{ background: 'oklch(0.73 0.12 78)', boxShadow: '0 0 8px oklch(0.73 0.12 78 / 0.8)' }} />
              <div className="h-3 w-0.5 rounded-full mt-1"
                style={{ background: 'oklch(0.73 0.12 78 / 0.4)' }} />
            </div>
            <span className="text-[9px] font-bold tracking-[0.3em] uppercase"
              style={{ color: 'oklch(0.73 0.12 78 / 0.7)' }}>
              {brand}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight"
            style={{ color: 'oklch(0.95 0.008 75)' }}>
            {title}
          </h1>
          {description && (
            <p className="text-sm" style={{ color: 'oklch(0.55 0.010 75)' }}>{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
        )}
      </div>
      {/* Separator: gold→transparent */}
      <div className="h-px"
        style={{ background: 'linear-gradient(90deg, oklch(0.73 0.12 78 / 0.50), oklch(0.73 0.12 78 / 0.10) 40%, transparent)' }}
      />
    </div>
  )
}

interface SectionHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

function SectionHeader({ title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: 'oklch(0.73 0.12 78 / 0.85)' }}>
          {title}
        </h2>
        {description && (
          <p className="text-xs" style={{ color: 'oklch(0.50 0.008 60)' }}>{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}

export { PageHeader, SectionHeader }
