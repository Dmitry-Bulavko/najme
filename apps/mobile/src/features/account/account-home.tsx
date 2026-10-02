import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ListGroup, ListItem, Section } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { UnverifiedEmailBanner } from '@/features/auth/unverified-email-banner';
import { enterBusinessMode } from '@/features/business/enter-mode';
import { useMyBusinesses } from '@/features/business/use-my-businesses';

import { ProfileHeaderCard } from './profile-header-card';

/**
 * Signed-in Account tab body: profile header, settings rows (extensible for later phases), and
 * sign-out with confirmation.
 */
export function AccountHome(): ReactElement | null {
  const { t } = useTranslation(['account', 'common', 'mobile', 'business']);
  const router = useRouter();
  const session = useSession();
  const myBusinesses = useMyBusinesses();

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

  function businessModeSubtitle(): string {
    if (myBusinesses.isLoading) return t('business:list.loading');
    if (myBusinesses.isError) return t('business:list.error');
    if (myBusinesses.isSuccess && myBusinesses.data.length === 0) {
      return t('business:menu.createBusiness');
    }
    if (myBusinesses.isSuccess && myBusinesses.data.length > 0) {
      return t('business:menu.switchBusiness');
    }
    return t('business:list.loading');
  }

  function openBusinessMode() {
    if (myBusinesses.isLoading) return;
    if (myBusinesses.isError) {
      void myBusinesses.refetch();
      return;
    }
    if (!myBusinesses.isSuccess) return;
    if (myBusinesses.data.length === 0) {
      void enterBusinessMode(router, []);
      return;
    }
    void enterBusinessMode(router, myBusinesses.data, {
      forcePick: myBusinesses.data.length > 1,
    });
  }

  return (
    <View style={styles.root} testID="account-signed-in">
      <UnverifiedEmailBanner />
      <ProfileHeaderCard me={me} />

      <Section title={t('account:pageTitle')}>
        <ListGroup>
          <ListItem
            icon="briefcase-outline"
            title={t('business:menu.businessMode')}
            subtitle={businessModeSubtitle()}
            onPress={openBusinessMode}
            testID="account-row-business-mode"
          />
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

const styles = StyleSheet.create({
  root: { gap: tokens.spacing.lg },
});
