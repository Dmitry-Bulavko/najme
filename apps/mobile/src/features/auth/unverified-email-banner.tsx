import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner, Button, Text } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useSession } from './auth-provider';

/**
 * Soft email-verification banner. Shown when the signed-in user has `emailVerified === false`.
 * Resend calls authenticated POST /auth/verify-email/resend (links open on web).
 */
export function UnverifiedEmailBanner(): ReactElement | null {
  const { t } = useTranslation(['auth', 'errors']);
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'resent' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (session.state !== 'authenticated' || session.me.emailVerified) {
    return null;
  }

  async function onResend() {
    setBusy(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: {} });
      setFeedback('resent');
    } catch (error) {
      setFeedback('error');
      if (error instanceof ApiError) {
        setErrorMessage(t(`errors:${error.code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } else {
        setErrorMessage(t('errors:HTTP_ERROR'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} testID="unverified-email-banner">
      <Banner tone="warning" message={t('auth:unverifiedBanner.message')} />
      <View style={styles.actions}>
        {feedback === 'resent' ? (
          <Text variant="caption" color="success">
            {t('auth:unverifiedBanner.resent')}
          </Text>
        ) : null}
        {feedback === 'error' && errorMessage ? (
          <Text variant="caption" color="danger" accessibilityRole="alert">
            {errorMessage}
          </Text>
        ) : null}
        <Button
          label={busy ? t('auth:unverifiedBanner.resending') : t('auth:unverifiedBanner.resend')}
          size="sm"
          variant="outline"
          loading={busy}
          onPress={() => void onResend()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing.sm },
  actions: { gap: tokens.spacing.sm, alignItems: 'flex-start' },
});
