import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

/** Placeholder route so the primary navigation resolves; replaced by the real screen in M1. */
export default async function BookingsPage(): Promise<ReactElement> {
  const t = await getTranslations('screens.bookings');

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-2 px-4 py-12 sm:px-6">
      <h1 className="text-heading">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
    </div>
  );
}
