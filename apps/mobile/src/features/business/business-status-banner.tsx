import { businessSchema, type Business, type BusinessStatus } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, Text } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';

type StatusBannerProps = {
  business: Business;
  onUpdated: (business: Business) => void;
};

const TONE: Record<BusinessStatus, 'info' | 'warning' | 'success' | 'error'> = {
  PENDING_APPROVAL: 'info',
  REJECTED: 'error',
  APPROVED: 'success',
  SUSPENDED: 'warning',
};

/**
 * Moderation status strip on the business overview. OWNER/ADMIN can resubmit REJECTED.
 */
export function BusinessStatusBanner({ business, onUpdated }: StatusBannerProps): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canResubmit =
    business.status === 'REJECTED' && (business.myRole === 'OWNER' || business.myRole === 'ADMIN');

  async function resubmit(): Promise<void> {
    setBusy(true);
    setError(null);
    setToast(null);
    try {
      const raw = await apiRequest<unknown>(`/businesses/${business.id}/resubmit`, {
        method: 'POST',
      });
      onUpdated(businessSchema.parse(raw));
      setToast(t('business:status.resubmitToast'));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
    } finally {
      setBusy(false);
    }
  }

  const titleKey = {
    PENDING_APPROVAL: 'status.pendingTitle',
    REJECTED: 'status.rejectedTitle',
    APPROVED: 'status.approvedTitle',
    SUSPENDED: 'status.suspendedTitle',
  }[business.status];

  const bodyKey =
    business.status === 'REJECTED' && !business.rejectionReason
      ? 'status.rejectedBodyNoReason'
      : {
          PENDING_APPROVAL: 'status.pendingBody',
          REJECTED: 'status.rejectedBody',
          APPROVED: 'status.approvedBody',
          SUSPENDED: 'status.suspendedBody',
        }[business.status];

  return (
    <View style={styles.root} testID="business-status-banner">
      <Banner
        tone={TONE[business.status]}
        message={`${t(`business:${titleKey}`)}\n${t(`business:${bodyKey}`)}`}
      />
      {business.status === 'REJECTED' && business.rejectionReason ? (
        <Text variant="body">{business.rejectionReason}</Text>
      ) : null}
      {toast ? <Banner tone="success" message={toast} /> : null}
      {error ? <Banner tone="error" message={error} /> : null}
      {canResubmit ? (
        <Button
          label={busy ? t('business:status.resubmitting') : t('business:status.resubmit')}
          loading={busy}
          onPress={() => void resubmit()}
          testID="business-resubmit"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.md },
});
