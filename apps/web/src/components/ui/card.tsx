import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('grid gap-1.5', className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>): ReactElement {
  return <h3 className={cn('text-subtitle leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>): ReactElement {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('text-sm', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('flex items-center gap-2', className)} {...props} />;
}
