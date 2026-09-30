import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui';
import { SignInCta } from '@/features/auth/sign-in-cta';
import { useSession } from '@/features/auth/auth-provider';

/** Bookings tab: sign-in CTA when anonymous; placeholder empty state when signed in. */
export default function BookingsScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile']);
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

  if (session.state === 'anonymous') {
    return (
      <Screen>
        <SignInCta
          title={t('mobile:bookings.signIn.title')}
          body={t('mobile:bookings.signIn.body')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <EmptyState
        icon="calendar-outline"
        message={t('common:screens.bookings.body')}
        hint={t('mobile:empty.bookings')}
      />
    </Screen>
  );
}
