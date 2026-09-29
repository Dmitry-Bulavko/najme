import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { LanguageSwitcher } from '@/features/locale/language-switcher';

import { AccountSlot } from './account-slot';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { Wordmark } from './wordmark';

export async function SiteHeader(): Promise<ReactElement> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('shell')]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-2 px-4 sm:px-6">
        <MobileNav className="md:hidden" />
        <Wordmark locale={locale} label={t('logoLabel')} />
        <MainNav className="ml-6 hidden md:block" />
        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher />
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
