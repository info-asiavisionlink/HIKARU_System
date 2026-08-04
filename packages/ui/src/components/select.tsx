'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../lib/utils'

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

// ---- Trigger ----
const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { error?: boolean }
>(({ className, children, error, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between gap-2',
      'rounded-[var(--radius)] border',
      'px-3 text-sm',
      'transition-all duration-150',
      'focus:outline-none focus:ring-1 focus:shadow-[0_0_15px_var(--color-primary-glow)]',
      'disabled:cursor-not-allowed disabled:opacity-35',
      '[&>span]:line-clamp-1',
      className
    )}
    style={{
      background: 'var(--color-surface)',
      color: 'var(--color-foreground)',
      borderColor: error ? 'var(--color-error)' : 'var(--color-border)',
    }}
    onMouseEnter={(e) => {
      if (!error) e.currentTarget.style.borderColor = 'var(--color-border-strong)'
    }}
    onMouseLeave={(e) => {
      if (!error) e.currentTarget.style.borderColor = 'var(--color-border)'
    }}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0" style={{ color: 'var(--color-muted-foreground)' }} />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

// ---- Scroll Buttons ----
const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn('flex cursor-pointer items-center justify-center py-1', className)}
    style={{ color: 'var(--color-muted-foreground)' }}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn('flex cursor-pointer items-center justify-center py-1', className)}
    style={{ color: 'var(--color-muted-foreground)' }}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName

// ---- Content ----
const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        'relative z-[var(--z-dropdown)]',
        'min-w-[8rem] overflow-hidden',
        'rounded-[var(--radius-lg)]',
        'data-[state=open]:animate-[zoom-in_0.12s_ease-out]',
        'data-[state=closed]:animate-[fade-out_0.1s_ease-in]',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
        className
      )}
      style={{
        background: 'oklch(0.12 0.035 245 / 0.95)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        border: '1px solid oklch(0.82 0.17 200 / 0.20)',
        boxShadow: '0 16px 40px oklch(0 0 0 / 0.5), 0 0 20px oklch(0.82 0.17 200 / 0.06)',
      }}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={cn(
          'p-1',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

// ---- Label ----
const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest', className)}
    style={{ color: 'oklch(0.55 0.05 220)' }}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

// ---- Item ----
const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2',
      'rounded-[var(--radius-sm)] px-2 py-2 text-sm',
      'outline-none transition-all duration-100',
      'data-[state=checked]:font-medium',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      className
    )}
    style={{ color: 'oklch(0.88 0.04 210)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'oklch(0.82 0.17 200 / 0.10)'
      e.currentTarget.style.color = 'oklch(0.82 0.17 200)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = 'oklch(0.88 0.04 210)'
    }}
    {...props}
  >
    <span className="absolute right-2 flex h-4 w-4 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" style={{ color: 'oklch(0.82 0.17 200)' }} />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

// ---- Separator ----
const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px', className)}
    style={{ background: 'oklch(0.82 0.17 200 / 0.12)' }}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select, SelectGroup, SelectValue, SelectTrigger,
  SelectContent, SelectLabel, SelectItem, SelectSeparator,
  SelectScrollUpButton, SelectScrollDownButton,
}
