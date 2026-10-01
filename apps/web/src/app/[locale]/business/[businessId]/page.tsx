import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { BusinessOverview } from '@/features/business/business-overview';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('overview.pageTitle') };
}

export default function BusinessOverviewPage(): ReactElement {
  return <BusinessOverview />;
}
