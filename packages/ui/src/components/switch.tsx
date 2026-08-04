'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../lib/utils'

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: string
  description?: string
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  SwitchProps
>(({ className, label, description, id, ...props }, ref) => {
  const switchId = id ?? React.useId()
  return (
    <div className="flex items-start gap-3">
      <SwitchPrimitive.Root
        id={switchId}
        ref={ref}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center',
          'rounded-[var(--radius-full)]',
          'border-2 border-transparent',
          'transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'bg-[var(--color-border)] data-[state=checked]:bg-[var(--color-primary)]',
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            'pointer-events-none block h-4 w-4 rounded-[var(--radius-full)]',
            'bg-white shadow-[var(--shadow-sm)]',
            'transition-transform duration-200',
            'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5'
          )}
        />
      </SwitchPrimitive.Root>
      {(label || description) && (
        <div className="flex flex-col gap-0.5 mt-0.5">
          {label && (
            <label
              htmlFor={switchId}
              className="text-sm font-medium text-[var(--color-foreground)] cursor-pointer"
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
Switch.displayName = 'Switch'

export { Switch }
