import type { ReactElement } from 'react';
import { Redirect } from 'expo-router';

import { Screen } from '@/components/ui';
import { AccountLanguageSettings } from '@/features/account/language-settings';
import { useSession } from '@/features/auth/auth-provider';

/** Account language picker (signed-in; updates API + app locale). */
export default function AccountLanguageScreen(): ReactElement {
  const session = useSession();

  if (session.state === 'anonymous') {
    return <Redirect href="/sign-in" />;
  }

  if (session.state === 'loading') {
    return <Screen edges={['bottom', 'left', 'right']}>{null}</Screen>;
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <AccountLanguageSettings />
    </Screen>
  );
}
