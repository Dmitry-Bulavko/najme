'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.List>): ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-10 items-center justify-center gap-1 rounded-md bg-secondary p-1 text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger>): ReactElement {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>): ReactElement {
  return (
    <TabsPrimitive.Content
      className={cn('mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
      {...props}
    />
  );
}
