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
import { tokens } from '@najme/ui-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { Banner, Button, Screen, Text, type BannerTone } from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { useMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';

import { isValidationFailedError } from './map-schedule-validation';
import { pastFromIso } from './time-off-body';
import { TimeOffSection } from './time-off-section';
import { WorkingHoursEditor } from './working-hours-editor';

type StaffScheduleViewProps = {
  staffId: string;
};

type ActionBanner = { tone: BannerTone; message: string };

/**
 * Working-hours + time-off editor for one staff member.
 * STAFF may only open their linked staffId; others see a 403 panel.
 */
export function StaffScheduleView({ staffId }: StaffScheduleViewProps): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { business } = useBusinessContext();
  const isStaff = business.myRole === 'STAFF';
  const {
    data: myBusinesses,
    isLoading: membershipsLoading,
    isError: membershipsError,
    refetch: refetchMemberships,
  } = useMyBusinesses();

  const myStaffMemberId = useMemo(() => {
    if (!isStaff) return null;
    const row = myBusinesses?.find((b) => b.businessId === business.id);
    return row?.staffMemberId ?? null;
  }, [business.id, isStaff, myBusinesses]);

  // OWNER/ADMIN never wait on /me/businesses — only STAFF need the linked staffMemberId.
  const forbidden =
    isStaff && !membershipsLoading && myStaffMemberId !== null && myStaffMemberId !== staffId;
  const staffUnlinked =
    isStaff &&
    !membershipsLoading &&
    !membershipsError &&
    myBusinesses !== undefined &&
    myStaffMemberId === null;
  const blockOnMemberships = isStaff && (membershipsLoading || membershipsError);

  const [member, setMember] = useState<StaffMember | null>(null);
  const [intervals, setIntervals] = useState<WorkingHoursInterval[] | null>(null);
  const [upcoming, setUpcoming] = useState<TimeOff[]>([]);
  const [past, setPast] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbiddenFromApi, setForbiddenFromApi] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const [actionBanner, setActionBanner] = useState<ActionBanner | null>(null);
  /** True after a successful load so a failed refetch keeps the editor mounted. */
  const hasLoadedRef = useRef(false);

  const apiBase = `/businesses/${business.id}/staff/${staffId}`;
  const pickerHref = businessHref(business.id, '/schedule');

  const load = useCallback(async () => {
    if (forbidden || staffUnlinked || blockOnMemberships) {
      return;
    }
    setLoading(true);
    setError(null);
    setForbiddenFromApi(false);
    try {
      const [staffRaw, hoursRaw, timeOffRaw] = await Promise.all([
        apiRequest<unknown>(apiBase),
        apiRequest<unknown>(`${apiBase}/working-hours`),
        apiRequest<unknown>(`${apiBase}/time-off?from=${pastFromIso()}`),
      ]);
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
      hasLoadedRef.current = true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbiddenFromApi(true);
        return;
      }
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      if (!hasLoadedRef.current) {
        setMember(null);
        setIntervals(null);
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, blockOnMemberships, forbidden, staffUnlinked, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function announceSuccess(message: string): void {
    setActionBanner({ tone: 'success', message });
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.announceForAccessibility(message);
    }
  }

  function showActionError(err: unknown): void {
    const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
    setActionBanner({
      tone: 'error',
      message: t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }),
    });
  }

  async function saveHours(next: WorkingHoursInterval[]): Promise<void> {
    setSavingHours(true);
    setActionBanner(null);
    try {
      const body = putWorkingHoursRequestSchema.parse({ intervals: next });
      const raw = await apiRequest<unknown>(`${apiBase}/working-hours`, {
        method: 'PUT',
        body,
      });
      setIntervals(workingHoursResponseSchema.parse(raw).intervals);
      announceSuccess(t('business:schedule.hours.savedToast'));
    } catch (err) {
      if (isValidationFailedError(err)) {
        // Editor maps field-level issues; rethrow so it can attach row errors.
        throw err;
      }
      showActionError(err);
    } finally {
      setSavingHours(false);
    }
  }

  async function createTimeOff(body: CreateTimeOffRequest): Promise<TimeOff> {
    // Errors propagate to TimeOffDialog (keep dialog open + inline Banner).
    const raw = await apiRequest<unknown>(`${apiBase}/time-off`, { method: 'POST', body });
    const created = timeOffSchema.parse(raw);
    announceSuccess(t('business:schedule.timeOff.createdToast'));
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
  }

  async function deleteTimeOff(timeOffId: string): Promise<void> {
    try {
      await apiRequest(`${apiBase}/time-off/${timeOffId}`, { method: 'DELETE' });
      announceSuccess(t('business:schedule.timeOff.deletedToast'));
      setUpcoming((prev) => prev.filter((row) => row.id !== timeOffId));
      setPast((prev) => prev.filter((row) => row.id !== timeOffId));
    } catch (err) {
      showActionError(err);
      throw err;
    }
  }

  function goToPicker(): void {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(pickerHref);
    }
  }

  if (isStaff && membershipsLoading) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('business:schedule.loading')}
        />
      </Screen>
    );
  }

  if (isStaff && membershipsError) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Banner tone="error" message={t('business:schedule.error')} />
        <Button
          label={t('business:schedule.retry')}
          variant="secondary"
          onPress={() => void refetchMemberships()}
        />
      </Screen>
    );
  }

  if (staffUnlinked) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Text variant="body" color="text03">
          {t('business:schedule.noLinkedStaff')}
        </Text>
        <Button
          label={t('business:schedule.backToOverview')}
          variant="secondary"
          onPress={() => router.replace(businessHref(business.id))}
        />
      </Screen>
    );
  }

  if (forbidden || forbiddenFromApi) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <View testID="schedule-forbidden" style={styles.block}>
          <Banner tone="error" message={t('business:schedule.forbidden')} />
          <Button
            label={t('business:schedule.backToOverview')}
            variant="secondary"
            onPress={() => router.replace(businessHref(business.id))}
          />
        </View>
      </Screen>
    );
  }

  if (loading && intervals === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('business:schedule.loading')}
        />
      </Screen>
    );
  }

  if (error && intervals === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Banner tone="error" message={error} />
        <View style={styles.row}>
          <Button
            label={t('business:schedule.retry')}
            variant="secondary"
            onPress={() => void load()}
          />
          {!isStaff ? (
            <Button
              label={t('business:schedule.backToPicker')}
              variant="secondary"
              onPress={goToPicker}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  if (intervals === null) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('business:schedule.loading')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom', 'left', 'right']}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={tokens.colors.primary}
        />
      }
    >
      <View style={styles.header} testID="staff-schedule">
        <Text variant="title" style={styles.heading}>
          {t('business:schedule.heading', { name: member?.displayName ?? '—' })}
        </Text>
        <Text variant="caption" color="text03">
          {t('business:schedule.subtitle')}
        </Text>
        <Text variant="caption" color="text03" testID="timezone-label">
          {t('business:schedule.timezone', { timezone: business.timezone })}
        </Text>
        {!isStaff ? (
          <View style={styles.row}>
            <Button
              label={t('business:schedule.backToPicker')}
              variant="secondary"
              size="sm"
              onPress={goToPicker}
              testID="back-to-picker"
            />
            <Button
              label={t('business:schedule.editStaff')}
              variant="secondary"
              size="sm"
              onPress={() => router.push(businessHref(business.id, `/staff/${staffId}`))}
            />
          </View>
        ) : null}
      </View>

      {error ? <Banner tone="error" message={error} /> : null}

      <WorkingHoursEditor
        key={`${staffId}-${intervals.map((i) => `${i.weekday}${i.start}${i.end}`).join('|')}`}
        initialIntervals={intervals}
        saving={savingHours}
        statusBanner={actionBanner}
        onSave={saveHours}
      />

      <TimeOffSection
        upcoming={upcoming}
        past={past}
        timeZone={business.timezone}
        onCreate={createTimeOff}
        onDelete={deleteTimeOff}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.xs, marginBottom: tokens.spacing.lg },
  heading: { fontFamily: fontFamilies.bold },
  block: { gap: tokens.spacing.md },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.sm,
  },
});
