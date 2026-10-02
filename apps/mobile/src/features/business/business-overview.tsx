import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Text } from '@/components/ui';
import { fontFamilies, MIN_TOUCH_TARGET } from '@/components/ui/theme';
import { ApiError } from '@/lib/api/client';

import { BusinessStatusBanner } from './business-status-banner';
import { useBusinessContext } from './business-provider';
import { loadChecklist, type ChecklistState } from './load-checklist';

/**
 * Business overview: status banner for everyone; setup checklist for OWNER/ADMIN only.
 */
export function BusinessOverview(): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
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
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      setChecklist(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, canManageSetup, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load checklist when role allows
    void refreshChecklist();
  }, [refreshChecklist]);

  const items = [
    {
      key: 'logo',
      done: checklist?.hasLogo ?? false,
      label: t('business:overview.itemLogo'),
      href: `/(business)/${business.id}/more/profile` as const,
    },
    {
      key: 'staff',
      done: checklist?.hasStaff ?? false,
      label: t('business:overview.itemStaff'),
      href: `/(business)/${business.id}/staff` as const,
    },
    {
      key: 'service',
      done: checklist?.hasServiceWithStaff ?? false,
      label: t('business:overview.itemService'),
      href: `/(business)/${business.id}/services` as const,
    },
    {
      key: 'hours',
      done: checklist?.allActiveHaveHours ?? false,
      label: t('business:overview.itemHours'),
      href: `/(business)/${business.id}/staff` as const,
    },
  ] as const;

  return (
    <View style={styles.root} testID="business-overview">
      <Text variant="title">{t('business:overview.heading')}</Text>

      <BusinessStatusBanner business={business} onUpdated={setBusiness} />

      {canManageSetup ? (
        <View style={styles.section}>
          <Text variant="body" style={styles.sectionTitle}>
            {t('business:overview.checklistHeading')}
          </Text>
          <Text variant="caption" color="text03">
            {t('business:overview.checklistSubtitle')}
          </Text>

          {loading ? (
            <ActivityIndicator
              color={tokens.colors.primary}
              accessibilityLabel={t('business:overview.loading')}
            />
          ) : error ? (
            <View style={styles.errorBlock}>
              <Banner tone="error" message={error} />
              <Button
                label={t('business:overview.retry')}
                variant="secondary"
                onPress={() => void refreshChecklist()}
              />
            </View>
          ) : (
            <View style={styles.list}>
              {items.map((item) => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [
                    styles.item,
                    item.done && styles.itemDone,
                    pressed && styles.itemPressed,
                  ]}
                >
                  <Text variant="body" style={styles.itemLabel}>
                    {item.label}
                  </Text>
                  <Text
                    variant="caption"
                    color={item.done ? 'primary' : 'text03'}
                    style={styles.itemStatus}
                  >
                    {item.done ? t('business:overview.done') : t('business:overview.todo')}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg },
  section: { gap: tokens.spacing.sm },
  sectionTitle: { fontFamily: fontFamilies.bold },
  errorBlock: { gap: tokens.spacing.md },
  list: { gap: tokens.spacing.sm, marginTop: tokens.spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: MIN_TOUCH_TARGET,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
    gap: tokens.spacing.md,
  },
  itemDone: {
    borderColor: tokens.colors.primary,
    backgroundColor: tokens.colors.secondary,
  },
  itemPressed: { backgroundColor: tokens.colors.secondary },
  itemLabel: { flex: 1, fontFamily: fontFamilies.medium },
  itemStatus: { fontFamily: fontFamilies.bold },
});
