import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ICON_BADGE_SIZE, ICON_SIZE } from '@/components/ui/theme';
import { Button, Card, ListGroup, ListItem, Screen, Text } from '@/components/ui';
import { SignInCta } from '@/features/auth/sign-in-cta';
import { UnverifiedEmailBanner } from '@/features/auth/unverified-email-banner';
import { useSession } from '@/features/auth/auth-provider';
import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { LanguageSwitcher } from '@/features/locale/language-switcher';

/**
 * Account tab: anonymous sign-in CTA, or a compact signed-in summary with unverified banner,
 * language switcher and API status. Profile/settings land in a later task.
 */
export default function AccountScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile', 'auth']);
  const router = useRouter();
  const session = useSession();

  if (session.state === 'loading') {
    return (
      <Screen>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('common:states.loading')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {session.state === 'anonymous' ? (
        <SignInCta
          title={t('mobile:account.signIn.title')}
          body={t('mobile:account.signIn.body')}
        />
      ) : (
        <>
          <UnverifiedEmailBanner />
          <Card style={styles.profile}>
            <View style={styles.iconWrap}>
              <Ionicons name="person" size={ICON_SIZE.lg} color={tokens.colors.primary} />
            </View>
            <Text variant="title">{session.me.displayName?.trim() || session.me.email}</Text>
            {session.me.displayName?.trim() ? (
              <Text variant="body" color="text03">
                {session.me.email}
              </Text>
            ) : null}
            <Button
              label={t('auth:header.signOut')}
              variant="outline"
              fullWidth
              onPress={() => void session.signOut()}
            />
          </Card>
        </>
      )}

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
  profile: { gap: tokens.spacing.md },
  iconWrap: {
    width: ICON_BADGE_SIZE.md,
    height: ICON_BADGE_SIZE.md,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
  },
  section: { gap: tokens.spacing.sm },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: tokens.spacing.xs },
});
