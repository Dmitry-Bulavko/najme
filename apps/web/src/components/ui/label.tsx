'use client';

import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>): ReactElement {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-sm leading-none font-bold text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
