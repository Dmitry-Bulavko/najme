import type { ReactElement } from 'react';
import { Redirect } from 'expo-router';

import { Screen } from '@/components/ui';
import { ChangePasswordForm } from '@/features/account/change-password-form';
import { useSession } from '@/features/auth/auth-provider';

/** Change password, or Google-only explanation when `hasPassword` is false. */
export default function ChangePasswordScreen(): ReactElement {
  const session = useSession();

  if (session.state === 'anonymous') {
    return <Redirect href="/sign-in" />;
  }

  if (session.state === 'loading') {
    return <Screen edges={['bottom', 'left', 'right']}>{null}</Screen>;
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <ChangePasswordForm />
    </Screen>
  );
}
