import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative grid grid-cols-[1rem_1fr] items-start gap-x-3 gap-y-1 rounded-md border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        info: 'border-info/30 bg-info/10 text-text01 [&>svg]:text-info',
        success: 'border-success/30 bg-success/10 text-text01 [&>svg]:text-success',
        warning: 'border-warning/30 bg-warning/10 text-text01 [&>svg]:text-warning',
        destructive: 'border-danger/30 bg-danger/10 text-text01 [&>svg]:text-danger',
      },
    },
    defaultVariants: { variant: 'info' },
  },
);

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  destructive: AlertCircle,
} as const;

export function Alert({
  className,
  variant = 'info',
  children,
  ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>): ReactElement {
  const Icon = icons[variant ?? 'info'];
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4" aria-hidden="true" />
      {children}
    </div>
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('col-start-2 leading-5 font-bold', className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentProps<'div'>): ReactElement {
  return <div className={cn('col-start-2 text-muted-foreground', className)} {...props} />;
}
