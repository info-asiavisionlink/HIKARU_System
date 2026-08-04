'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../lib/utils'

interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: string
  description?: string
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, label, description, id, ...props }, ref) => {
  const checkId = id ?? React.useId()
  return (
    <div className="flex gap-3 items-start">
      <CheckboxPrimitive.Root
        id={checkId}
        ref={ref}
        className={cn(
          'peer h-5 w-5 shrink-0 mt-0.5 rounded-[var(--radius-sm)]',
          'border-2 border-[var(--color-border)] bg-[var(--color-surface)]',
          'transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'data-[state=checked]:bg-[var(--color-primary)] data-[state=checked]:border-[var(--color-primary)]',
          className
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
          <Check className="h-3 w-3 stroke-[3]" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              htmlFor={checkId}
              className="text-sm font-medium text-[var(--color-foreground)] cursor-pointer leading-snug
                         peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-[var(--color-muted-foreground)]">{description}</p>
          )}
        </div>
      )}
    </div>
  )
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
