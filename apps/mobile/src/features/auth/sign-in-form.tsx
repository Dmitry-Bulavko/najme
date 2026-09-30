import { zodResolver } from '@hookform/resolvers/zod';
import { loginRequestSchema, type LoginRequest } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { Link, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, FormField, Text } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { useSession } from './auth-provider';
import { GoogleSignInButton } from './google-sign-in-button';

export function SignInForm(): ReactElement {
  const { t } = useTranslation(['auth', 'errors']);
  const router = useRouter();
  const { signIn } = useSession();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(data: LoginRequest) {
    setApiError(null);
    try {
      await signIn(data);
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
        label={t('auth:signIn.emailLabel')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <FormField
        control={control}
        name="password"
        label={t('auth:signIn.passwordLabel')}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
      />

      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/forgot-password')}
        style={styles.forgot}
      >
        <Text variant="caption" color="text03">
          {t('auth:signIn.forgotPassword')}
        </Text>
      </Pressable>

      <Button
        label={t('auth:signIn.submit')}
        fullWidth
        loading={isSubmitting}
        onPress={() => void handleSubmit(onSubmit)()}
      />

      <GoogleSignInButton />

      <View style={styles.footer}>
        <Text variant="body" color="text03">
          {t('auth:signIn.noAccount')}{' '}
        </Text>
        <Link href="/sign-up" asChild>
          <Pressable accessibilityRole="link">
            <Text variant="body" color="primary">
              {t('auth:signIn.signUpLink')}
            </Text>
          </Pressable>
        </Link>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg },
  forgot: { alignSelf: 'flex-end' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
});
