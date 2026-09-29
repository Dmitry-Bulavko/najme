'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Avatar({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>): ReactElement {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

export function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>): ReactElement {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full', className)} {...props} />;
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>): ReactElement {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'flex size-full items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground',
        className,
      )}
      {...props}
    />
  );
}
