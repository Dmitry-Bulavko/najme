'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/features/auth/session-context';

import { readLastBusinessId, writeLastBusinessId } from './last-business';
import { useMyBusinesses } from './use-my-businesses';

/**
 * `/business` index: redirect to last/only/first membership, or list when `?pick=1`.
 */
export function BusinessIndexView() {
  const t = useTranslations('business');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forcePick = searchParams.get('pick') === '1';
  const session = useSession();
  const { data, isLoading, isError, refetch } = useMyBusinesses();

  useEffect(() => {
    if (session.state === 'anonymous') {
      router.replace(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/business`)}`);
    }
  }, [locale, router, session.state]);

  useEffect(() => {
    if (!data || forcePick || data.length === 0) return;

    if (data.length === 1) {
      writeLastBusinessId(data[0]!.businessId);
      router.replace(`/${locale}/business/${data[0]!.businessId}`);
      return;
    }

    const last = readLastBusinessId();
    const match = last ? data.find((b) => b.businessId === last) : undefined;
    const target = match ?? data[0]!;
    writeLastBusinessId(target.businessId);
    router.replace(`/${locale}/business/${target.businessId}`);
  }, [data, forcePick, locale, router]);

  const redirecting = Boolean(data && data.length > 0 && !forcePick);

  if (session.state === 'loading' || session.state === 'anonymous' || isLoading || redirecting) {
    return (
      <div
        className="mx-auto w-full max-w-2xl space-y-4 px-4 py-10"
        aria-busy="true"
        aria-label={t('list.loading')}
      >
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-destructive">{t('list.error')}</p>
        <Button className="mt-3" variant="outline" onClick={() => void refetch()}>
          {t('list.retry')}
        </Button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
        <Button className="mt-4" asChild>
          <Link href={`/${locale}/business/new`}>{t('list.emptyCta')}</Link>
        </Button>
      </div>
    );
  }

  // `?pick=1` — explicit switcher list.
  return (
    <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
      <div className="mt-10 mb-16 space-y-6">
        <div>
          <h1 className="text-title font-bold text-foreground">{t('list.heading')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('list.subtitle')}</p>
        </div>
        <ul className="space-y-2">
          {data.map((biz) => (
            <li key={biz.businessId}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-border p-4 text-left transition-colors hover:bg-secondary"
                onClick={() => {
                  writeLastBusinessId(biz.businessId);
                  router.push(`/${locale}/business/${biz.businessId}`);
                }}
              >
                <span>
                  <span className="block font-medium text-foreground">{biz.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {t('list.role', { role: biz.role })}
                  </span>
                </span>
                <span className="text-sm font-medium text-primary">{t('list.open')}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/business/new`}>{t('menu.createBusiness')}</Link>
        </Button>
      </div>
    </div>
  );
}
