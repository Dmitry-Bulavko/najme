import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Account area of the header. Shows a "Sign in" button until the auth tasks wire up sessions, at
 * which point this switches to an avatar dropdown for signed-in users.
 */
export async function AccountSlot(): Promise<ReactElement> {
  const t = await getTranslations('shell');
  return <Button size="sm">{t('signIn')}</Button>;
}
