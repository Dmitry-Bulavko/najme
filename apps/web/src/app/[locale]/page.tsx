import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { CategoryChips } from '@/features/home/category-chips';
import { HeroSearch } from '@/features/home/hero-search';
import { isApiHealthy } from '@/lib/health';

export default async function HomePage(): Promise<ReactElement> {
  const [t, online] = await Promise.all([getTranslations('home.hero'), isApiHealthy()]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-secondary via-background to-background">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-16 text-center sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-2xl gap-4">
            <h1 className="text-heading text-balance sm:text-display">{t('title')}</h1>
            <p className="text-body-large text-pretty text-muted-foreground">{t('subtitle')}</p>
          </div>
          <HeroSearch />
        </div>
      </section>
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6">
        <CategoryChips />
        <ApiStatusBadge online={online} />
      </div>
    </>
  );
}
