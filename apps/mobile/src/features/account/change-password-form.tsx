import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordRequestSchema, passwordSchema } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useMemo, useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Banner, Button, FormField, Text } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiError } from '@/lib/api/client';

import { changePasswordWithLock } from './change-password';

type PasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

/**
 * Change-password form, or a Google-only explanation when `hasPassword` is false.
 * On success, holds the auth mutex while persisting the rotated session tokens (#56).
 */
export function ChangePasswordForm(): ReactElement {
  const { t } = useTranslation(['account', 'errors']);
  const session = useSession();
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const hasPassword = session.state === 'authenticated' && session.me.hasPassword;

  const passwordFormSchema = useMemo(
    () =>
      changePasswordRequestSchema
        .extend({
          confirmPassword: z.string().min(1),
          newPassword: passwordSchema,
        })
        .refine((data) => data.newPassword === data.confirmPassword, {
          path: ['confirmPassword'],
          message: t('account:passwordSection.mismatch'),
        }),
    [t],
  );

  const {
    control,
    handleSubmit,
    setError,
    reset,
    formState: { isSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  if (!hasPassword) {
    return (
      <Text variant="body" color="text03" testID="account-password-google-only">
        {t('account:passwordSection.googleOnly')}
      </Text>
    );
  }

  async function onSubmit(data: PasswordFormValues) {
    setApiError(null);
    setSaved(false);
    try {
      const authSession = await changePasswordWithLock({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (session.state === 'authenticated') {
        session.updateMe(authSession.user);
      }
      reset();
      setSaved(true);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setError('currentPassword', {
          message: t('errors:INVALID_CREDENTIALS'),
        });
        return;
      }
      if (error instanceof ApiError) {
        setApiError(t(`errors:${error.code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } else {
        setApiError(t('errors:HTTP_ERROR'));
      }
    }
  }

  return (
    <View style={styles.form}>
      {saved ? <Banner tone="success" message={t('account:passwordSection.saved')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      <FormField
        control={control}
        name="currentPassword"
        label={t('account:passwordSection.currentLabel')}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />
      <FormField
        control={control}
        name="newPassword"
        label={t('account:passwordSection.newLabel')}
        secureTextEntry
        autoComplete="password-new"
        textContentType="newPassword"
      />
      <FormField
        control={control}
        name="confirmPassword"
        label={t('account:passwordSection.confirmLabel')}
        secureTextEntry
        autoComplete="password-new"
        textContentType="newPassword"
      />

      <Button
        label={t('account:passwordSection.save')}
        fullWidth
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
});
