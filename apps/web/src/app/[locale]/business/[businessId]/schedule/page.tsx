import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { SchedulePicker } from '@/features/schedule/schedule-picker';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('schedule.pickerPageTitle') };
}

export default function BusinessSchedulePickerPage(): ReactElement {
  return <SchedulePicker />;
}
