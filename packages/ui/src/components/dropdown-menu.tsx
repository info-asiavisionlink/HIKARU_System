'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { cn } from '../lib/utils'

const DropdownMenu = DropdownMenuPrimitive.Root
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-[var(--z-dropdown)] min-w-[180px] overflow-hidden',
        'rounded-[var(--radius-lg)] p-1.5',
        'data-[state=open]:animate-[zoom-in_0.15s_ease-out]',
        'data-[state=closed]:animate-[fade-out_0.10s_ease-in]',
        className
      )}
      style={{
        background: 'oklch(0.10 0.006 255 / 0.96)',
        backdropFilter: 'blur(32px) saturate(1.8)',
        border: '1px solid oklch(0.73 0.12 78 / 0.25)',
        boxShadow: '0 20px 50px oklch(0 0 0 / 0.60), 0 0 30px oklch(0.73 0.12 78 / 0.06)',
      }}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const itemBase = 'relative flex cursor-pointer select-none items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm outline-none transition-all duration-150 data-[disabled]:pointer-events-none data-[disabled]:opacity-40'

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & { inset?: boolean; destructive?: boolean }
>(({ className, inset, destructive, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(itemBase, inset && 'pl-8', className)}
    style={{ color: destructive ? 'oklch(0.65 0.25 27)' : 'oklch(0.88 0.008 75)' }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = destructive
        ? 'oklch(0.65 0.25 27 / 0.10)'
        : 'oklch(0.73 0.12 78 / 0.08)'
      e.currentTarget.style.color = destructive
        ? 'oklch(0.70 0.25 27)'
        : 'oklch(0.82 0.13 78)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent'
      e.currentTarget.style.color = destructive ? 'oklch(0.65 0.25 27)' : 'oklch(0.88 0.008 75)'
    }}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    checked={checked}
    className={cn(itemBase, 'pl-8', className)}
    style={{ color: 'oklch(0.88 0.008 75)' }}
    {...props}
  >
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" style={{ color: 'oklch(0.73 0.12 78)' }} />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.25em]', inset && 'pl-8', className)}
    style={{ color: 'oklch(0.73 0.12 78 / 0.60)' }}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1.5 my-1.5 h-px', className)}
    style={{ background: 'oklch(0.73 0.12 78 / 0.12)' }}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

export {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup,
  DropdownMenuPortal, DropdownMenuSub, DropdownMenuRadioGroup,
  DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator,
}
