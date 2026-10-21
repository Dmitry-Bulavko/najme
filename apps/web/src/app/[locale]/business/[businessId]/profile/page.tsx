import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { BusinessProfileForm } from '@/features/business/business-profile-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('profile.pageTitle') };
}

export default function BusinessProfilePage(): ReactElement {
  return <BusinessProfileForm />;
}
