import { staffMembersResponseSchema, type StaffMember } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { Banner, Button, ListGroup, ListItem, Screen, Text } from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { useMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';

import { resolveScheduleHref, staffScheduleHref } from './schedule-href';

/**
 * OWNER/ADMIN pick a staff member to edit hours.
 * STAFF are redirected to their linked schedule (or shown an empty state).
 */
export function SchedulePicker(): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
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
    const href = resolveScheduleHref(business.id, 'STAFF', myStaffMemberId);
    if (href) {
      router.replace(href);
    }
  }, [business.id, isStaff, membershipsError, membershipsLoading, myStaffMemberId, router]);

  const load = useCallback(async () => {
    if (isStaff) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/staff`);
      setStaff(staffMembersResponseSchema.parse(raw));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      // Keep previous rows on a failed refetch.
    } finally {
      setLoading(false);
    }
  }, [business.id, isStaff, t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (isStaff) {
    if (membershipsLoading) {
      return (
        <Screen edges={['bottom', 'left', 'right']}>
          <ActivityIndicator
            color={tokens.colors.primary}
            accessibilityLabel={t('business:schedule.loading')}
          />
        </Screen>
      );
    }
    if (membershipsError) {
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
    if (myStaffMemberId) {
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
      <Screen edges={['bottom', 'left', 'right']}>
        <View style={styles.block} testID="schedule-no-linked">
          <Text variant="body" color="text03">
            {t('business:schedule.noLinkedStaff')}
          </Text>
          <Button
            label={t('business:schedule.backToOverview')}
            variant="secondary"
            onPress={() => router.replace(businessHref(business.id))}
          />
        </View>
      </Screen>
    );
  }

  const empty = staff !== null && staff.length === 0;
  const showInitialSpinner = loading && staff === null;

  return (
    <Screen
      edges={['bottom', 'left', 'right']}
      refreshControl={
        <RefreshControl
          refreshing={loading && staff !== null}
          onRefresh={() => void load()}
          tintColor={tokens.colors.primary}
        />
      }
    >
      <View style={styles.header} testID="schedule-picker">
        <Text variant="title" style={styles.heading}>
          {t('business:schedule.pickerHeading')}
        </Text>
        <Text variant="caption" color="text03">
          {t('business:schedule.pickerSubtitle')}
        </Text>
        <Text variant="caption" color="text03" testID="timezone-label">
          {t('business:schedule.timezone', { timezone: business.timezone })}
        </Text>
      </View>

      {showInitialSpinner ? (
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('business:schedule.loading')}
        />
      ) : error && !staff ? (
        <View style={styles.block}>
          <Banner tone="error" message={error} />
          <Button
            label={t('business:schedule.retry')}
            variant="secondary"
            onPress={() => void load()}
          />
        </View>
      ) : empty ? (
        <View style={styles.block}>
          <Text variant="body" color="text03">
            {t('business:schedule.pickerEmpty')}
          </Text>
          <Button
            label={t('business:schedule.pickerEmptyCta')}
            onPress={() => router.push(businessHref(business.id, '/staff/new'))}
            testID="picker-empty-cta"
          />
        </View>
      ) : (
        <>
          {error ? <Banner tone="error" message={error} /> : null}
          <ListGroup>
            {staff?.map((member) => (
              <ListItem
                key={member.id}
                title={member.displayName}
                subtitle={member.active ? t('business:staff.active') : t('business:staff.inactive')}
                onPress={() => router.push(staffScheduleHref(business.id, member.id))}
                accessibilityLabel={`${member.displayName}, ${t('business:schedule.openSchedule')}`}
                testID={`open-schedule-${member.id}`}
              />
            ))}
          </ListGroup>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.xs, marginBottom: tokens.spacing.lg },
  heading: { fontFamily: fontFamilies.bold },
  block: { gap: tokens.spacing.md },
});
