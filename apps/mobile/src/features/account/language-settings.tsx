import { meSchema } from '@najme/contracts';
import { isLocale, LOCALE_META, SUPPORTED_LOCALES, type Locale } from '@najme/i18n';
import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Banner, ListGroup, ListItem } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { setLocale } from '@/i18n';
import { ApiError, apiRequest } from '@/lib/api/client';

/**
 * Account-backed language picker: PATCH /me with the chosen locale, then `setLocale` so the app
 * UI updates immediately (ADR-0004). Used when signed in; anonymous users keep the device switcher.
 *
 * If `setLocale` fails after a successful PATCH, the account locale is already saved server-side,
 * so we report success and warn locally instead of showing an error (#148).
 */
export function AccountLanguageSettings(): ReactElement {
  const { t, i18n } = useTranslation(['account', 'errors', 'common']);
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const activeLocale: Locale =
    session.state === 'authenticated' && isLocale(session.me.locale)
      ? session.me.locale
      : isLocale(i18n.language)
        ? i18n.language
        : 'en';

  async function onSelect(locale: Locale) {
    if (busy || locale === activeLocale) {
      return;
    }
    setBusy(true);
    setApiError(null);
    setSaved(false);
    try {
      const raw = await apiRequest<unknown>('/me', {
        method: 'PATCH',
        body: { locale },
      });
      const parsed = meSchema.safeParse(raw);
      if (!parsed.success) {
        setApiError(t('errors:HTTP_ERROR'));
        return;
      }
      if (session.state === 'authenticated') {
        session.updateMe(parsed.data);
      }
      // setLocale updates the UI locale; a failure here is non-fatal — the account locale was
      // already persisted server-side, so we still report success and warn instead of erroring.
      try {
        await setLocale(locale);
      } catch (localeError) {
        console.warn(
          '[language-settings] setLocale failed after successful PATCH /me; UI may lag:',
          localeError,
        );
      }
      setSaved(true);
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
    <View style={styles.root}>
      {saved ? <Banner tone="success" message={t('account:languageSection.saved')} /> : null}
      {apiError ? <Banner tone="error" message={apiError} /> : null}

      <View accessibilityRole="radiogroup" accessibilityLabel={t('account:languageSection.label')}>
        <ListGroup>
          {SUPPORTED_LOCALES.map((locale) => (
            <ListItem
              key={locale}
              accessibilityRole="radio"
              title={LOCALE_META[locale].label}
              selected={locale === activeLocale}
              onPress={() => {
                void onSelect(locale);
              }}
              testID={`account-locale-${locale}`}
            />
          ))}
        </ListGroup>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg },
});
