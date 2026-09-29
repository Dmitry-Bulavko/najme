import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Separator } from '@/components/ui/separator';

import { Wordmark } from './wordmark';

export async function SiteFooter(): Promise<ReactElement> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('shell')]);

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6">
        <div className="grid gap-3">
          <Wordmark locale={locale} label={t('logoLabel')} />
          <p className="max-w-md text-sm text-muted-foreground">{t('footer.tagline')}</p>
        </div>
        <Separator />
        <p className="text-xs text-muted-foreground">
          {t('footer.rights', { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
