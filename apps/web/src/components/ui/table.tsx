import type { ComponentProps, ReactElement } from 'react';

import { cn } from '@/lib/utils';

export function Table({ className, ...props }: ComponentProps<'table'>): ReactElement {
  return (
    <div className="relative w-full overflow-x-auto" role="region" tabIndex={0}>
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>): ReactElement {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>): ReactElement {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>): ReactElement {
  return (
    <tfoot
      className={cn('border-t bg-secondary/50 font-bold [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>): ReactElement {
  return (
    <tr
      className={cn(
        'border-b transition-colors hover:bg-secondary/40 data-[state=selected]:bg-secondary',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<'th'>): ReactElement {
  return (
    <th
      className={cn(
        'h-10 px-3 text-left align-middle text-xs font-bold text-muted-foreground whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>): ReactElement {
  return <td className={cn('px-3 py-2.5 align-middle', className)} {...props} />;
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>): ReactElement {
  return <caption className={cn('mt-3 text-sm text-muted-foreground', className)} {...props} />;
}
