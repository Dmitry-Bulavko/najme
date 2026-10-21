import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { CreateBusinessForm } from '@/features/business/create-business-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('create.pageTitle') };
}

export default function CreateBusinessPage(): ReactElement {
  return <CreateBusinessForm />;
}
