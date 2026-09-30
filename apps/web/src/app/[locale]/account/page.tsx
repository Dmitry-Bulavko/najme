import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { AccountView } from '@/features/account/account-view';

/**
 * `/[locale]/account` — profile and settings. Auth gate and forms live in AccountView.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });
  return { title: t('pageTitle') };
}

export default function AccountPage(): ReactElement {
  return <AccountView />;
}
