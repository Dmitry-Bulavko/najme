import { zodResolver } from '@hookform/resolvers/zod';
import { registerRequestSchema, type RegisterRequest } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { Link, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button, FormField, Text } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { useSession } from './auth-provider';
import { GoogleSignInButton } from './google-sign-in-button';

/**
 * Sign-up form schema: contract email/password plus optional displayName that may be empty
 * (empty string is omitted before the API call).
 */
const signUpFormSchema = registerRequestSchema.pick({ email: true, password: true }).extend({
  displayName: z.string().optional(),
});

type SignUpFormValues = z.infer<typeof signUpFormSchema>;

export function SignUpForm(): ReactElement {
  const { t, i18n } = useTranslation(['auth', 'errors']);
  const router = useRouter();
  const { signUp } = useSession();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpFormSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  async function onSubmit(data: SignUpFormValues) {
    setApiError(null);
    const locale = i18n.language;
    const body: RegisterRequest = {
      email: data.email,
      password: data.password,
      ...(locale === 'en' || locale === 'me' || locale === 'ru' || locale === 'tr'
        ? { locale }
        : {}),
      ...(data.displayName?.trim() ? { displayName: data.displayName.trim() } : {}),
    };
    try {
      await signUp(body);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/account');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        setApiError(t(`errors:${error.code}`, { defaultValue: t('errors:HTTP_ERROR') }));
      } else {
        setApiError(t('errors:HTTP_ERROR'));
      }
    }
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
        label={t('auth:signUp.emailLabel')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <FormField
        control={control}
        name="password"
        label={t('auth:signUp.passwordLabel')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <FormField
        control={control}
        name="displayName"
        label={t('auth:signUp.displayNameLabel')}
        helperText={t('auth:signUp.displayNameHint')}
        autoComplete="name"
        textContentType="name"
      />

      <Button
        label={t('auth:signUp.submit')}
        fullWidth
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />

      <GoogleSignInButton />

      <View style={styles.footer}>
        <Text variant="body" color="text03">
          {t('auth:signUp.hasAccount')}{' '}
        </Text>
        <Link href="/sign-in" asChild>
          <Pressable accessibilityRole="link">
            <Text variant="body" color="primary">
              {t('auth:signUp.signInLink')}
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
