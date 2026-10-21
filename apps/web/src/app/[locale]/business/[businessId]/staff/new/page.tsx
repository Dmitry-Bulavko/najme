import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { StaffForm } from '@/features/staff/staff-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('staff.createPageTitle') };
}

export default function BusinessStaffCreatePage(): ReactElement {
  return <StaffForm mode="create" />;
}
