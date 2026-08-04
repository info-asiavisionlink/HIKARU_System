import * as React from 'react'
import { cn } from '../lib/utils'

function TableWrapper({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('w-full overflow-x-auto rounded-[var(--radius-lg)]', className)}
      style={{
        background: 'oklch(0.09 0.005 255 / 0.80)',
        backdropFilter: 'blur(24px) saturate(1.4)',
        border: '1px solid oklch(0.73 0.12 78 / 0.18)',
      }}
      {...props}
    >
      {children}
    </div>
  )
}

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn('border-b', className)}
      style={{
        background: 'oklch(0.73 0.12 78 / 0.06)',
        borderColor: 'oklch(0.73 0.12 78 / 0.18)',
      }}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

function TableFooter({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('font-medium border-t', className)}
      style={{
        background: 'oklch(0.73 0.12 78 / 0.04)',
        borderColor: 'oklch(0.73 0.12 78 / 0.15)',
      }}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn('border-b transition-all duration-150', className)}
      style={{ borderColor: 'oklch(0.73 0.12 78 / 0.08)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'oklch(0.73 0.12 78 / 0.04)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-11 px-4 text-left whitespace-nowrap',
        'text-[9px] font-bold uppercase tracking-[0.25em]',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      style={{ color: 'oklch(0.73 0.12 78 / 0.75)' }}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm align-middle',
        '[&:has([role=checkbox])]:pr-0',
        className
      )}
      style={{ color: 'oklch(0.88 0.008 75)' }}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-4 text-sm text-center', className)}
      style={{ color: 'oklch(0.50 0.008 60)' }}
      {...props}
    />
  )
}

export { TableWrapper, Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
