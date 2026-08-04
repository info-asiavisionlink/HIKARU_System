'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '../lib/utils'

const Tabs = TabsPrimitive.Root

// ---- TabsList ----
const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex items-center gap-0.5',
      'rounded-[var(--radius-lg)] p-1',
      'bg-[var(--color-muted)]',
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

// ---- TabsTrigger ----
const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap',
      'rounded-[var(--radius-md)] px-3 py-1.5',
      'text-sm font-medium',
      'text-[var(--color-muted-foreground)]',
      'transition-all duration-150',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:bg-[var(--color-surface)] data-[state=active]:text-[var(--color-foreground)]',
      'data-[state=active]:shadow-[var(--shadow-xs)]',
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

// ---- TabsContent ----
const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-3',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2',
      'data-[state=active]:animate-[fade-in_0.15s_ease-out]',
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

// ---- UnderlineTabs (alternative style) ----
const UnderlineTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex items-center gap-0',
      'border-b border-[var(--color-border)]',
      className
    )}
    {...props}
  />
))
UnderlineTabsList.displayName = 'UnderlineTabsList'

const UnderlineTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'relative px-4 pb-3 pt-0',
      'text-sm font-medium text-[var(--color-muted-foreground)]',
      'transition-colors duration-150',
      'hover:text-[var(--color-foreground)]',
      'focus-visible:outline-none',
      'disabled:pointer-events-none disabled:opacity-50',
      'data-[state=active]:text-[var(--color-primary)]',
      'data-[state=active]:after:absolute data-[state=active]:after:bottom-[-1px]',
      'data-[state=active]:after:left-0 data-[state=active]:after:right-0',
      'data-[state=active]:after:h-0.5 data-[state=active]:after:rounded-full',
      'data-[state=active]:after:bg-[var(--color-primary)]',
      className
    )}
    {...props}
  />
))
UnderlineTabsTrigger.displayName = 'UnderlineTabsTrigger'

export { Tabs, TabsList, TabsTrigger, TabsContent, UnderlineTabsList, UnderlineTabsTrigger }
