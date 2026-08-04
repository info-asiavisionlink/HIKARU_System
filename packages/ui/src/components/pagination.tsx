'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '../lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  const pages = React.useMemo(() => {
    const delta = 1
    const range: (number | 'ellipsis')[] = []
    const left = Math.max(2, page - delta)
    const right = Math.min(totalPages - 1, page + delta)

    range.push(1)
    if (left > 2) range.push('ellipsis')
    for (let i = left; i <= right; i++) range.push(i)
    if (right < totalPages - 1) range.push('ellipsis')
    if (totalPages > 1) range.push(totalPages)

    return range
  }, [page, totalPages])

  if (totalPages <= 1) return null

  return (
    <nav
      role="navigation"
      aria-label="ページネーション"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <PageButton
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="前のページ"
      >
        <ChevronLeft className="h-4 w-4" />
      </PageButton>

      {pages.map((p, idx) =>
        p === 'ellipsis' ? (
          <span key={`ellipsis-${idx}`} className="flex h-9 w-9 items-center justify-center">
            <MoreHorizontal className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          </span>
        ) : (
          <PageButton
            key={p}
            onClick={() => onPageChange(p)}
            isActive={p === page}
            aria-label={`${p}ページ目`}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </PageButton>
        )
      )}

      <PageButton
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="次のページ"
      >
        <ChevronRight className="h-4 w-4" />
      </PageButton>
    </nav>
  )
}

function PageButton({
  isActive,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { isActive?: boolean }) {
  return (
    <button
      className={cn(
        'inline-flex h-9 min-w-9 items-center justify-center rounded-[var(--radius)]',
        'px-2 text-sm font-medium transition-colors duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-40',
        isActive
          ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-xs)]'
          : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export { Pagination }
