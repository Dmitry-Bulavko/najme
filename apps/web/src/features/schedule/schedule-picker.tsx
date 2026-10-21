'use client';

import { staffMembersResponseSchema, type StaffMember } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessContext } from '@/features/business/business-shell';
import { useMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { resolveScheduleHref, staffScheduleHref } from './schedule-href';

/**
 * OWNER/ADMIN pick a staff member to edit hours.
 * STAFF are redirected to their linked schedule (or shown an empty state).
 */
export function SchedulePicker() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const { business } = useBusinessContext();
  const {
    data: myBusinesses,
    isLoading: membershipsLoading,
    isError: membershipsError,
    refetch: refetchMemberships,
  } = useMyBusinesses();
  const isStaff = business.myRole === 'STAFF';

  const myStaffMemberId = useMemo(() => {
    const row = myBusinesses?.find((b) => b.businessId === business.id);
    return row?.staffMemberId ?? null;
  }, [business.id, myBusinesses]);

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isStaff);

  useEffect(() => {
    if (!isStaff || membershipsLoading || membershipsError) return;
    const href = resolveScheduleHref(locale, business.id, 'STAFF', myStaffMemberId);
    if (href) {
      router.replace(href);
    }
  }, [business.id, isStaff, locale, membershipsError, membershipsLoading, myStaffMemberId, router]);

  const load = useCallback(async () => {
    if (isStaff) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff`);
      setStaff(staffMembersResponseSchema.parse(raw));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(errorMessage(tErrors, code));
      setStaff(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, isStaff, tErrors]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load staff for picker
    void load();
  }, [load]);

  if (isStaff) {
    if (membershipsLoading) {
      return (
        <div className="space-y-4" aria-busy="true" aria-label={t('schedule.loading')}>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }
    if (membershipsError) {
      return (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {t('schedule.error')}
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            onClick={() => void refetchMemberships()}
          >
            {t('schedule.retry')}
          </Button>
        </div>
      );
    }
    if (myStaffMemberId) {
      return (
        <div className="space-y-4" aria-busy="true" aria-label={t('schedule.loading')}>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 w-full" />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground" role="status">
          {t('schedule.noLinkedStaff')}
        </p>
        <Button asChild variant="secondary">
          <Link href={`/${locale}/business/${business.id}`}>{t('schedule.backToOverview')}</Link>
        </Button>
      </div>
    );
  }

  const empty = staff !== null && staff.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-bold text-foreground">{t('schedule.pickerHeading')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('schedule.pickerSubtitle')}</p>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {t('schedule.timezone', { timezone: business.timezone })}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('schedule.loading')}>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <div className="rounded-md border border-border p-4 text-center">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => void load()}>
            {t('schedule.retry')}
          </Button>
        </div>
      ) : empty ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('schedule.pickerEmpty')}</p>
          <Button asChild className="mt-4">
            <Link href={`/${locale}/business/${business.id}/staff/new`}>
              {t('schedule.pickerEmptyCta')}
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {staff?.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">{member.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {member.active ? t('staff.active') : t('staff.inactive')}
                </p>
              </div>
              <Button asChild size="sm">
                <Link href={staffScheduleHref(locale, business.id, member.id)}>
                  {t('schedule.openSchedule')}
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
