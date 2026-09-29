import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-secondary', className)}
      {...props}
    />
  );
}
