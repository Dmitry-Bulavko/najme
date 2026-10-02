import {
  formatMinorAsMajor,
  servicesResponseSchema,
  type ContractLocale,
  type Service,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Banner, Button, Screen, Text, confirm } from '@/components/ui';
import { useBusinessContext } from '@/features/business/business-provider';
import { businessHref } from '@/features/business/last-business';
import { ApiError, apiRequest } from '@/lib/api/client';

/** Services list: duration, price, staff count, active; OWNER/ADMIN can manage. */
export function ServiceList(): ReactElement {
  const { t, i18n } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { business } = useBusinessContext();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const base = businessHref(business.id, '/services');
  const locale = (
    ['en', 'me', 'ru', 'tr'].includes(i18n.language) ? i18n.language : 'en'
  ) as ContractLocale;

  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/services`);
      setServices(servicesResponseSchema.parse(raw));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      setServices(null);
    } finally {
      setLoading(false);
    }
  }, [business.id, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load on mount / business change
    void load();
  }, [load]);

  const empty = useMemo(() => services !== null && services.length === 0, [services]);

  async function onDelete(service: Service): Promise<void> {
    const ok = await confirm({
      title: t('business:services.deleteTitle'),
      message: t('business:services.deleteDescription', { name: service.name }),
      confirmLabel: t('business:services.deleteConfirm'),
      cancelLabel: t('business:services.deleteCancel'),
      destructive: true,
    });
    if (!ok) return;

    setDeletingId(service.id);
    setToast(null);
    try {
      await apiRequest(`/businesses/${business.id}/services/${service.id}`, { method: 'DELETE' });
      setToast(t('business:services.deletedToast'));
      setServices((prev) => prev?.filter((s) => s.id !== service.id) ?? null);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setToast(null);
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Screen scroll edges={['bottom', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text variant="title">{t('business:services.heading')}</Text>
            <Text variant="caption" color="text03">
              {canManage
                ? t('business:services.subtitle')
                : t('business:services.readOnlySubtitle')}
            </Text>
          </View>
          {canManage ? (
            <Button
              label={t('business:services.add')}
              onPress={() => router.push(`${base}/new`)}
              testID="services-add"
            />
          ) : null}
        </View>

        {toast ? <Banner tone="success" message={toast} /> : null}
        {error && services ? <Banner tone="error" message={error} /> : null}

        {loading ? (
          <View
            style={styles.centered}
            accessibilityLabel={t('business:services.loading')}
            accessibilityState={{ busy: true }}
          >
            <ActivityIndicator color={tokens.colors.primary} />
          </View>
        ) : error && !services ? (
          <View style={styles.centered}>
            <Banner tone="error" message={error} />
            <Button
              label={t('business:services.retry')}
              variant="secondary"
              onPress={() => void load()}
            />
          </View>
        ) : empty ? (
          <View style={styles.centered} testID="services-empty">
            <Text variant="body" color="text03">
              {t('business:services.empty')}
            </Text>
            {canManage ? (
              <Button
                label={t('business:services.emptyCta')}
                onPress={() => router.push(`${base}/new`)}
                testID="services-empty-cta"
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {services?.map((service) => (
              <View key={service.id} style={styles.row} testID={`service-row-${service.id}`}>
                <View style={styles.rowBody}>
                  <Text variant="body" numberOfLines={1}>
                    {service.name}
                  </Text>
                  <Text variant="caption" color="text03">
                    {t('business:services.listMeta', {
                      duration: service.durationMinutes,
                      price: `${formatMinorAsMajor(service.price.amount, locale)} ${service.price.currency}`,
                      staffCount: service.staffMemberIds.length,
                    })}
                  </Text>
                  <Text variant="caption" color={service.active ? 'text01' : 'text03'}>
                    {service.active
                      ? t('business:services.active')
                      : t('business:services.inactive')}
                  </Text>
                </View>
                {canManage ? (
                  <View style={styles.actions}>
                    <Button
                      label={t('business:services.edit')}
                      variant="secondary"
                      size="sm"
                      onPress={() => router.push(`${base}/${service.id}`)}
                    />
                    <Button
                      label={t('business:services.delete')}
                      variant="destructive"
                      size="sm"
                      loading={deletingId === service.id}
                      disabled={deletingId === service.id}
                      onPress={() => void onDelete(service)}
                      testID={`service-delete-${service.id}`}
                    />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg, padding: tokens.spacing.lg },
  header: { gap: tokens.spacing.md },
  headerText: { gap: tokens.spacing.xs },
  centered: {
    gap: tokens.spacing.md,
    alignItems: 'center',
    paddingVertical: tokens.spacing['2xl'],
  },
  list: {
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: tokens.colors.base04,
  },
  rowBody: { flex: 1, gap: tokens.spacing.xs, minWidth: 0 },
  actions: { gap: tokens.spacing.xs },
});
