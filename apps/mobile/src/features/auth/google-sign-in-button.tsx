/**
 * Native Google Sign-In button (ADR-0010, R6).
 *
 * Visible only when:
 * - `GET /auth/providers` reports `google: true`,
 * - `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` are set,
 * - the native module is available (dev/production build — not Expo Go / web).
 */
import { authProvidersSchema } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Divider, Text } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useSession } from './auth-provider';
import { canOfferGoogleSignIn, googleEnvConfigured } from './google-availability';

export function GoogleSignInButton(): ReactElement | null {
  const { t, i18n } = useTranslation(['auth', 'errors']);
  const router = useRouter();
  const { signInWithGoogle } = useSession();
  const [providersOk, setProvidersOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!googleEnvConfigured() || !canOfferGoogleSignIn()) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const raw = await apiRequest<unknown>('/auth/providers', { method: 'GET' });
        const providers = authProvidersSchema.safeParse(raw);
        if (!cancelled && providers.success && providers.data.google) {
          setProvidersOk(true);
        }
      } catch {
        // Keep hidden when the probe fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!googleEnvConfigured() || !canOfferGoogleSignIn() || !providersOk) {
    return null;
  }

  async function onPress() {
    setApiError(null);
    setBusy(true);
    try {
      // Lazy require — never evaluate the native module until the user taps in a dev build.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GoogleSignin } = require('@react-native-google-signin/google-signin') as {
        GoogleSignin: {
          configure: (options: {
            iosClientId?: string;
            webClientId: string;
            offlineAccess?: boolean;
          }) => void;
          hasPlayServices: (options?: {
            showPlayServicesUpdateDialog?: boolean;
          }) => Promise<boolean>;
          signIn: () => Promise<{ data?: { idToken?: string | null } | null; type?: string }>;
        };
      };

      GoogleSignin.configure({
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        // Env is checked by googleEnvConfigured / canOfferGoogleSignIn before render.
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string,
        offlineAccess: false,
      });

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const result = await GoogleSignin.signIn();
      const idToken = result.data?.idToken;
      if (!idToken) {
        setApiError(t('errors:GOOGLE_TOKEN_INVALID'));
        return;
      }

      const locale = i18n.language;
      await signInWithGoogle(
        idToken,
        locale === 'en' || locale === 'me' || locale === 'ru' || locale === 'tr'
          ? locale
          : undefined,
      );
      // Same leave-auth-screen path as email/password sign-in and sign-up.
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrap} testID="google-sign-in">
      <View style={styles.dividerRow}>
        <Divider style={styles.divider} />
        <Text variant="caption" color="text03">
          {t('auth:google.or')}
        </Text>
        <Divider style={styles.divider} />
      </View>
      {apiError ? (
        <Text variant="caption" color="danger" accessibilityRole="alert">
          {apiError}
        </Text>
      ) : null}
      <Button
        label={t('auth:google.continueWith')}
        variant="outline"
        fullWidth
        loading={busy}
        onPress={() => void onPress()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.md },
  divider: { flex: 1 },
});
