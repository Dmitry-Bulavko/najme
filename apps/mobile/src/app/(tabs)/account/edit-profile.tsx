import type { ReactElement } from 'react';
import { Redirect } from 'expo-router';

import { Screen } from '@/components/ui';
import { EditProfileForm } from '@/features/account/edit-profile-form';
import { useSession } from '@/features/auth/auth-provider';

/** Edit display name (signed-in only). */
export default function EditProfileScreen(): ReactElement {
  const session = useSession();

  if (session.state === 'anonymous') {
    return <Redirect href="/sign-in" />;
  }

  if (session.state === 'loading') {
    return <Screen edges={['bottom', 'left', 'right']}>{null}</Screen>;
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <EditProfileForm />
    </Screen>
  );
}
