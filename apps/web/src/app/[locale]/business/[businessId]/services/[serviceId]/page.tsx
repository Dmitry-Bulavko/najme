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
  return { title: t('services.editPageTitle') };
}

export default async function BusinessServiceEditPage({
  params,
}: {
  params: Promise<{ serviceId: string }>;
}): Promise<ReactElement> {
  const { serviceId } = await params;
  return <ServiceForm mode="edit" serviceId={serviceId} />;
}
