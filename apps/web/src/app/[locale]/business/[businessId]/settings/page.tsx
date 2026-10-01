import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { BusinessSettingsForm } from '@/features/business/business-settings-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('settings.pageTitle') };
}

export default function BusinessSettingsPage(): ReactElement {
  return <BusinessSettingsForm />;
}
