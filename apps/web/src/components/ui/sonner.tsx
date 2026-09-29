'use client';

import type { ComponentProps, ReactElement } from 'react';
import { Toaster as Sonner } from 'sonner';

/** Toast host, styled with the design tokens. Mount once in the layout; call `toast()` anywhere. */
export function Toaster(props: ComponentProps<typeof Sonner>): ReactElement {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            '!rounded-md !border !border-border !bg-popover !text-popover-foreground !shadow-lg !font-sans',
          description: '!text-muted-foreground',
        },
      }}
      {...props}
    />
  );
}
