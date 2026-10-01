import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { StaffScheduleView } from '@/features/schedule/staff-schedule-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('schedule.pageTitle') };
}

export default async function StaffSchedulePage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}): Promise<ReactElement> {
  const { staffId } = await params;
  return <StaffScheduleView staffId={staffId} />;
}
