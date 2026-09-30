import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ListGroup, ListItem, Text } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { UnverifiedEmailBanner } from '@/features/auth/unverified-email-banner';

import { ProfileHeaderCard } from './profile-header-card';

/**
 * Signed-in Account tab body: profile header, settings rows (extensible for later phases), and
 * sign-out with confirmation.
 */
export function AccountHome(): ReactElement | null {
  const { t } = useTranslation(['account', 'common', 'mobile']);
  const router = useRouter();
  const session = useSession();

  if (session.state !== 'authenticated') {
    return null;
  }

  const { me, signOut } = session;

  function confirmSignOut() {
    Alert.alert(t('account:signOutConfirm.title'), t('account:signOutConfirm.body'), [
      { text: t('common:actions.cancel'), style: 'cancel' },
      {
        text: t('account:signOutConfirm.confirm'),
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }

  return (
    <View style={styles.root} testID="account-signed-in">
      <UnverifiedEmailBanner />
      <ProfileHeaderCard me={me} />

      <Section title={t('account:pageTitle')}>
        <ListGroup>
          <ListItem
            icon="person-outline"
            title={t('account:settings.editProfile')}
            onPress={() => router.push('/account/edit-profile')}
            testID="account-row-edit-profile"
          />
          <ListItem
            icon="language-outline"
            title={t('account:settings.language')}
            onPress={() => router.push('/account/language')}
            testID="account-row-language"
          />
          <ListItem
            icon="lock-closed-outline"
            title={t('account:settings.changePassword')}
            onPress={() => router.push('/account/change-password')}
            testID="account-row-change-password"
          />
          <ApiStatusBadge />
          <ListItem
            icon="log-out-outline"
            title={t('account:signOut')}
            onPress={confirmSignOut}
            testID="account-row-sign-out"
          />
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
    </View>
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
  root: { gap: tokens.spacing.lg },
  section: { gap: tokens.spacing.sm },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginLeft: tokens.spacing.xs,
  },
});
