'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

import { NAV_ITEMS } from './nav-items';

/** Desktop primary navigation (hidden below `md`, where the mobile Sheet takes over). */
export function MainNav({ className }: { className?: string }): ReactElement {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav aria-label={t('label')} className={className}>
      <ul className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, labelKey }) => {
          const target = `/${locale}/${href}`;
          const active = pathname === target || pathname.startsWith(`${target}/`);
          return (
            <li key={href}>
              <Link
                href={target}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-bold text-muted-foreground transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
                  active && 'bg-secondary text-primary hover:text-primary',
                )}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
