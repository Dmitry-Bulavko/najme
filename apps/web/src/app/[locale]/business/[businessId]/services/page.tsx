import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { ServiceList } from '@/features/services/service-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('services.pageTitle') };
}

export default function BusinessServicesPage(): ReactElement {
  return <ServiceList />;
}
