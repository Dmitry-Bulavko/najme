import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { AdminBusinessesView } from '@/features/admin/admin-businesses-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('pageTitle') };
}

export default function AdminBusinessesPage(): ReactElement {
  return <AdminBusinessesView />;
}
