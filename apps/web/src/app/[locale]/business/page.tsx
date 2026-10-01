import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { BusinessIndexView } from '@/features/business/business-index-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('list.pageTitle') };
}

export default function BusinessIndexPage(): ReactElement {
  return <BusinessIndexView />;
}
