'use client'

import * as React from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../lib/utils'

interface SearchBarProps {
  value?: string
  onChange?: (value: string) => void
  onClear?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

function SearchBar({
  value = '',
  onChange,
  onClear,
  placeholder = '検索...',
  className,
  autoFocus,
}: SearchBarProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value)
  }
  const handleClear = () => {
    onChange?.('')
    onClear?.()
  }

  return (
    <div className={cn('relative flex items-center', className)}>
      <Search
        className="absolute left-3 h-4 w-4 pointer-events-none z-10"
        style={{ color: 'oklch(0.82 0.17 200 / 0.5)' }}
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          'h-10 w-full rounded-[var(--radius)] border',
          'pl-9 text-sm',
          'transition-all duration-200',
          'focus:outline-none focus:ring-1',
          value ? 'pr-9' : 'pr-3'
        )}
        style={{
          background:   'var(--color-surface)',
          color:        'var(--color-foreground)',
          borderColor:  'var(--color-border)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'oklch(0.82 0.17 200 / 0.5)'
          e.currentTarget.style.boxShadow = '0 0 15px oklch(0.82 0.17 200 / 0.12)'
          e.currentTarget.style.background = 'var(--color-surface-raised)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.background = 'var(--color-surface)'
        }}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="検索をクリア"
          className={cn(
            'absolute right-2.5 rounded-full p-0.5',
            'transition-all duration-100',
          )}
          style={{ color: 'oklch(0.55 0.05 220)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'oklch(0.82 0.17 200)'
            e.currentTarget.style.background = 'oklch(0.82 0.17 200 / 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'oklch(0.55 0.05 220)'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

export { SearchBar }
