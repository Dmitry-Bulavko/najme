'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { cn } from '@/lib/utils';

import { BusinessStatusBanner } from './business-status-banner';
import { useBusinessContext } from './business-shell';
import { loadChecklist, type ChecklistState } from './load-checklist';

/**
 * Business overview: status banner for everyone; setup checklist for OWNER/ADMIN only
 * (STAFF cannot complete those items, and hours GETs for other staff return 403).
 */
export function BusinessOverview() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const { business, setBusiness } = useBusinessContext();
  const canManageSetup = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const [checklist, setChecklist] = useState<ChecklistState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(canManageSetup);

  const refreshChecklist = useCallback(async () => {
    if (!canManageSetup) {
      setLoading(false);
      setChecklist(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setChecklist(await loadChecklist(business.id));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
      setChecklist(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, canManageSetup, tErrors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load checklist when role allows
    void refreshChecklist();
  }, [refreshChecklist]);

  const base = `/${locale}/business/${business.id}`;
  const items = [
    {
      key: 'logo',
      done: checklist?.hasLogo ?? false,
      label: t('overview.itemLogo'),
      href: `${base}/profile`,
    },
    {
      key: 'staff',
      done: checklist?.hasStaff ?? false,
      label: t('overview.itemStaff'),
      href: `${base}/staff`,
    },
    {
      key: 'service',
      done: checklist?.hasServiceWithStaff ?? false,
      label: t('overview.itemService'),
      href: `${base}/services`,
    },
    {
      key: 'hours',
      done: checklist?.allActiveHaveHours ?? false,
      label: t('overview.itemHours'),
      href: `${base}/schedule`,
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-foreground">{t('overview.heading')}</h1>
      </div>

      <BusinessStatusBanner business={business} onUpdated={setBusiness} />

      {canManageSetup ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-foreground">{t('overview.checklistHeading')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('overview.checklistSubtitle')}</p>
          </div>

          {loading ? (
            <div className="space-y-2" aria-busy="true" aria-label={t('overview.loading')}>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-md border border-border p-4 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button className="mt-3" variant="outline" onClick={() => void refreshChecklist()}>
                {t('overview.retry')}
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center justify-between rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-secondary',
                      item.done && 'border-primary/30 bg-secondary/60',
                    )}
                  >
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span
                      className={cn(
                        'text-xs font-bold',
                        item.done ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {item.done ? t('overview.done') : t('overview.todo')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}
