'use client'

import * as React from 'react'
import { cn } from '../lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, hint, leftIcon, rightIcon, id, ...props }, ref) => {
    const inputId = id ?? React.useId()
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: 'oklch(0.73 0.12 78 / 0.80)' }}
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 pointer-events-none z-10"
              style={{ color: 'oklch(0.60 0.010 75)' }}>
              {leftIcon}
            </span>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            className={cn(
              'w-full h-10 rounded-[var(--radius)] text-sm',
              'transition-all duration-250',
              'focus:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-30',
              leftIcon  ? 'pl-9'  : 'pl-3',
              rightIcon ? 'pr-9' : 'pr-3',
              className
            )}
            style={{
              background: 'oklch(0.10 0.006 255)',
              color:      'oklch(0.95 0.008 75)',
              border:     error
                ? '1px solid oklch(0.65 0.25 27 / 0.60)'
                : '1px solid oklch(0.73 0.12 78 / 0.20)',
            }}
            onFocus={(e) => {
              if (!error) {
                e.currentTarget.style.border = '1px solid oklch(0.73 0.12 78 / 0.60)'
                e.currentTarget.style.boxShadow = '0 0 16px oklch(0.73 0.12 78 / 0.20), inset 0 0 0 1px oklch(0.73 0.12 78 / 0.08)'
                e.currentTarget.style.background = 'oklch(0.12 0.007 255)'
              }
              props.onFocus?.(e)
            }}
            onBlur={(e) => {
              if (!error) {
                e.currentTarget.style.border = '1px solid oklch(0.73 0.12 78 / 0.20)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.background = 'oklch(0.10 0.006 255)'
              }
              props.onBlur?.(e)
            }}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3"
              style={{ color: 'oklch(0.60 0.010 75)' }}>
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p className="text-xs" style={{ color: 'oklch(0.65 0.25 27)' }}>{error}</p>
        )}
        {!error && hint && (
          <p className="text-xs" style={{ color: 'oklch(0.50 0.008 60)' }}>{hint}</p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
