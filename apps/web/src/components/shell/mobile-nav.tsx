'use client';

import { Menu } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

import { NAV_ITEMS } from './nav-items';

/** Hamburger + Sheet navigation, shown below `md`. */
export function MobileNav({ className }: { className?: string }): ReactElement {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tShell = useTranslations('shell');
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={t('openMenu')}>
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" closeLabel={tShell('close')} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>{t('menuTitle')}</SheetTitle>
        </SheetHeader>
        <nav aria-label={t('label')}>
          <ul className="grid gap-1">
            {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
              const target = `/${locale}/${href}`;
              const active = pathname === target || pathname.startsWith(`${target}/`);
              return (
                <li key={href}>
                  <SheetClose asChild>
                    <Link
                      href={target}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-3 text-base font-bold text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring',
                        active &&
                          'bg-secondary text-secondary-foreground shadow-[inset_3px_0_0_0_var(--color-primary)]',
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                      {t(labelKey)}
                    </Link>
                  </SheetClose>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
