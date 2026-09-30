import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ListGroup, ListItem, Screen, Text } from '@/components/ui';
import { AccountHome } from '@/features/account/account-home';
import { SignInCta } from '@/features/auth/sign-in-cta';
import { useSession } from '@/features/auth/auth-provider';
import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { LanguageSwitcher } from '@/features/locale/language-switcher';

/**
 * Account tab: anonymous sign-in CTA with device language + API status, or the signed-in
 * profile/settings home (#56).
 */
export default function AccountScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile']);
  const router = useRouter();
  const session = useSession();

  if (session.state === 'loading') {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('common:states.loading')}
        />
      </Screen>
    );
  }

  if (session.state === 'authenticated') {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <AccountHome />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <SignInCta title={t('mobile:account.signIn.title')} body={t('mobile:account.signIn.body')} />

      <Section title={t('mobile:account.language')}>
        <LanguageSwitcher />
      </Section>

      <Section title={t('mobile:account.apiSection')}>
        <ListGroup>
          <ApiStatusBadge />
        </ListGroup>
      </Section>

      {__DEV__ ? (
        <Section title={t('mobile:account.developer')}>
          <ListGroup>
            <ListItem
              icon="color-palette-outline"
              title={t('mobile:account.uiKit')}
              subtitle={t('mobile:account.uiKitHint')}
              onPress={() => router.push('/ui-showcase')}
            />
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="text03" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.sm },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: tokens.spacing.xs,
  },
});
