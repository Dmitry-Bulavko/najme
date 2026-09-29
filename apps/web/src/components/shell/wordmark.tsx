import Link from 'next/link';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

/** The Najme logo: a brand-coloured star tile plus the wordmark. Links to the locale home page. */
export function Wordmark({
  locale,
  label,
  className,
}: {
  locale: string;
  /** Accessible name of the link (localized). */
  label: string;
  className?: string;
}): ReactElement {
  return (
    <Link
      href={`/${locale}`}
      aria-label={label}
      className={cn(
        'flex items-center gap-2 rounded-md text-title font-extrabold tracking-tight text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm"
      >
        <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor">
          <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8L12 2.5z" />
        </svg>
      </span>
      <span aria-hidden="true">Najme</span>
    </Link>
  );
}
