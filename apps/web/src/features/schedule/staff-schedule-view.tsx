'use client';

import {
  putWorkingHoursRequestSchema,
  staffMemberSchema,
  timeOffListResponseSchema,
  timeOffSchema,
  workingHoursResponseSchema,
  type CreateTimeOffRequest,
  type StaffMember,
  type TimeOff,
  type WorkingHoursInterval,
} from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusinessContext } from '@/features/business/business-shell';
import { useMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { TimeOffSection } from './time-off-section';
import { WorkingHoursEditor } from './working-hours-editor';
import { isValidationFailedError } from './map-schedule-validation';

type StaffScheduleViewProps = {
  staffId: string;
};

/**
 * Working-hours + time-off editor for one staff member.
 * STAFF may only open their linked staffId; others see a 403 panel.
 */
export function StaffScheduleView({ staffId }: StaffScheduleViewProps) {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const { business } = useBusinessContext();
  const {
    data: myBusinesses,
    isLoading: membershipsLoading,
    isError: membershipsError,
    refetch: refetchMemberships,
  } = useMyBusinesses();

  const myStaffMemberId = useMemo(() => {
    const row = myBusinesses?.find((b) => b.businessId === business.id);
    return row?.staffMemberId ?? null;
  }, [business.id, myBusinesses]);

  const isStaff = business.myRole === 'STAFF';
  const forbidden =
    isStaff && !membershipsLoading && myStaffMemberId !== null && myStaffMemberId !== staffId;
  const staffUnlinked =
    isStaff &&
    !membershipsLoading &&
    !membershipsError &&
    myBusinesses !== undefined &&
    myStaffMemberId === null;

  const [member, setMember] = useState<StaffMember | null>(null);
  const [intervals, setIntervals] = useState<WorkingHoursInterval[] | null>(null);
  const [upcoming, setUpcoming] = useState<TimeOff[]>([]);
  const [past, setPast] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenFromApi, setForbiddenFromApi] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [loadNonce, setLoadNonce] = useState(0);

  const staffBase = `/${locale}/business/${business.id}/staff`;
  const apiBase = `/businesses/${business.id}/staff/${staffId}`;

  const reload = useCallback(() => {
    setLoadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (forbidden || staffUnlinked || membershipsLoading || membershipsError) {
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setForbiddenFromApi(false);
      try {
        const [staffRaw, hoursRaw, timeOffRaw] = await Promise.all([
          apiRequest<unknown>(apiBase),
          apiRequest<unknown>(`${apiBase}/working-hours`),
          apiRequest<unknown>(`${apiBase}/time-off?from=${pastFromIso()}`),
        ]);
        if (cancelled) return;
        setMember(staffMemberSchema.parse(staffRaw));
        setIntervals(workingHoursResponseSchema.parse(hoursRaw).intervals);
        const list = timeOffListResponseSchema.parse(timeOffRaw);
        const nowMs = Date.now();
        setUpcoming(
          list
            .filter((row) => new Date(row.endsAt).getTime() > nowMs)
            .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
        );
        setPast(
          list
            .filter((row) => new Date(row.endsAt).getTime() <= nowMs)
            .sort((a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime()),
        );
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 403) {
          setForbiddenFromApi(true);
          return;
        }
        const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
        setError(errorMessage(tErrors, code));
        setMember(null);
        setIntervals(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, forbidden, membershipsError, membershipsLoading, staffUnlinked, tErrors, loadNonce]);

  async function saveHours(next: WorkingHoursInterval[]): Promise<void> {
    setSavingHours(true);
    try {
      const body = putWorkingHoursRequestSchema.parse({ intervals: next });
      const raw = await apiRequest<unknown>(`${apiBase}/working-hours`, {
        method: 'PUT',
        body,
      });
      setIntervals(workingHoursResponseSchema.parse(raw).intervals);
      toast.success(t('schedule.hours.savedToast'));
    } catch (err) {
      if (isValidationFailedError(err)) {
        // Editor maps field-level issues; rethrow so it can attach row errors.
        throw err;
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
    } finally {
      setSavingHours(false);
    }
  }

  async function createTimeOff(body: CreateTimeOffRequest): Promise<TimeOff> {
    try {
      const raw = await apiRequest<unknown>(`${apiBase}/time-off`, { method: 'POST', body });
      const created = timeOffSchema.parse(raw);
      toast.success(t('schedule.timeOff.createdToast'));
      const nowMs = Date.now();
      if (new Date(created.endsAt).getTime() <= nowMs) {
        setPast((prev) =>
          [...prev, created].sort(
            (a, b) => new Date(b.endsAt).getTime() - new Date(a.endsAt).getTime(),
          ),
        );
      } else {
        setUpcoming((prev) =>
          [...prev, created].sort(
            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
          ),
        );
      }
      return created;
    } catch (err) {
      if (isValidationFailedError(err)) {
        throw err;
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
      throw err;
    }
  }

  async function deleteTimeOff(timeOffId: string): Promise<void> {
    try {
      await apiRequest(`${apiBase}/time-off/${timeOffId}`, { method: 'DELETE' });
      toast.success(t('schedule.timeOff.deletedToast'));
      setUpcoming((prev) => prev.filter((row) => row.id !== timeOffId));
      setPast((prev) => prev.filter((row) => row.id !== timeOffId));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      toast.error(errorMessage(tErrors, code));
      throw err;
    }
  }

  if (membershipsLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('schedule.loading')}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (isStaff && membershipsError) {
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

  if (staffUnlinked) {
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

  if (forbidden || forbiddenFromApi) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive" role="alert">
          {t('schedule.forbidden')}
        </p>
        <Button asChild variant="secondary">
          <Link href={`/${locale}/business/${business.id}`}>{t('schedule.backToOverview')}</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('schedule.loading')}>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error || intervals === null) {
    return (
      <div className="rounded-md border border-border p-4 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error ?? t('schedule.error')}
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="secondary" onClick={reload}>
            {t('schedule.retry')}
          </Button>
          {!isStaff ? (
            <Button asChild variant="secondary">
              <Link href={`/${locale}/business/${business.id}/schedule`}>
                {t('schedule.backToPicker')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-title font-bold text-foreground">
          {t('schedule.heading', { name: member?.displayName ?? '—' })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('schedule.subtitle')}</p>
        <p className="mt-2 text-xs font-medium text-muted-foreground" data-testid="timezone-label">
          {t('schedule.timezone', { timezone: business.timezone })}
        </p>
        {!isStaff ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/${locale}/business/${business.id}/schedule`}>
                {t('schedule.backToPicker')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href={`${staffBase}/${staffId}`}>{t('schedule.editStaff')}</Link>
            </Button>
          </div>
        ) : null}
      </div>

      <WorkingHoursEditor
        key={`${staffId}-${intervals.map((i) => `${i.weekday}${i.start}${i.end}`).join('|')}`}
        initialIntervals={intervals}
        saving={savingHours}
        onSave={saveHours}
      />

      <TimeOffSection
        upcoming={upcoming}
        past={past}
        timeZone={business.timezone}
        onCreate={createTimeOff}
        onDelete={deleteTimeOff}
      />
    </div>
  );
}

/** Two years back so past time-off still appears in the broad list. */
function pastFromIso(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString();
}
