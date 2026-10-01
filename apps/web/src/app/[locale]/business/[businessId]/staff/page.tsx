import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { StaffList } from '@/features/staff/staff-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('staff.pageTitle') };
}

export default function BusinessStaffPage(): ReactElement {
  return <StaffList />;
}
