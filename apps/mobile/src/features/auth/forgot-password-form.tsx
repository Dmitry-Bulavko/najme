import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordRequestSchema, type ForgotPasswordRequest } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { Link } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';

/**
 * Forgot-password form. Always shows the "sent" confirmation after a successful response so the
 * UI never reveals whether the email exists (ADR-0011).
 */
export function ForgotPasswordForm(): ReactElement {
  const { t } = useTranslation(['auth', 'errors']);
  const [sent, setSent] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordRequest>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(data: ForgotPasswordRequest) {
    setApiError(null);
    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: data });
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(t(`errors:${error.code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } else {
        setApiError(t('errors:HTTP_ERROR'));
      }
    }
  }

  if (sent) {
    return (
      <View style={styles.form}>
        <Text variant="title" accessibilityRole="header">
          {t('auth:forgotPassword.sentTitle')}
        </Text>
        <Text variant="body" color="text03">
          {t('auth:forgotPassword.sentBody')}
        </Text>
        <Link href="/sign-in" asChild>
          <Pressable accessibilityRole="link">
            <Text variant="body" color="primary">
              {t('auth:forgotPassword.backToSignIn')}
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <View style={styles.form}>
      {apiError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {apiError}
        </Text>
      ) : null}

      <FormField
        control={control}
        name="email"
        label={t('auth:forgotPassword.emailLabel')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <Button
        label={t('auth:forgotPassword.submit')}
        fullWidth
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />

      <Link href="/sign-in" asChild>
        <Pressable accessibilityRole="link" style={styles.back}>
          <Text variant="body" color="text03">
            {t('auth:forgotPassword.backToSignIn')}
          </Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  back: { alignSelf: 'center' },
});
