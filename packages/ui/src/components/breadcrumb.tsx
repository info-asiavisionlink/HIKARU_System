import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="パンくずリスト" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={idx} className="flex items-center gap-1">
              {isLast ? (
                <span
                  className="font-medium text-[var(--color-foreground)] truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : (
                <>
                  <a
                    href={item.href ?? '#'}
                    className={cn(
                      'text-[var(--color-muted-foreground)] truncate max-w-[160px]',
                      'transition-colors duration-100',
                      'hover:text-[var(--color-foreground)]',
                      'focus-visible:outline-none focus-visible:underline'
                    )}
                  >
                    {item.label}
                  </a>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--color-subtle)] shrink-0" />
                </>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export { Breadcrumb, type BreadcrumbItem }
