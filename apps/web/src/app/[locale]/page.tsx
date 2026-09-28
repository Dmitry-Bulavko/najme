import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { LanguageSwitcher } from '@/features/locale/language-switcher';
import { isApiHealthy } from '@/lib/health';

export default async function HomePage(): Promise<ReactElement> {
  const [t, online] = await Promise.all([getTranslations(), isApiHealthy()]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-4 text-center">
      <LanguageSwitcher />
      <h1 className="text-display font-bold">{t('appName')}</h1>
      <p className="text-body">{t('tagline')}</p>
      <ApiStatusBadge online={online} />
    </main>
  );
}
