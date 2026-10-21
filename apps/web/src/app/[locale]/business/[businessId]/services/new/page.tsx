import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ServiceForm } from '@/features/services/service-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('services.createPageTitle') };
}

export default function BusinessServiceCreatePage(): ReactElement {
  return <ServiceForm mode="create" />;
}
