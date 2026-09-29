import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Input({
  className,
  type = 'text',
  ...props
}: ComponentProps<'input'>): ReactElement {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full min-w-0 rounded-md border border-input bg-card px-3 text-sm text-foreground shadow-xs transition-colors outline-none placeholder:text-muted-foreground hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/30',
        className,
      )}
      {...props}
    />
  );
}
