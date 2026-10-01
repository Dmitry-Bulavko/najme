import { getTranslations } from 'next-intl/server';
import type { ReactElement } from 'react';

import { TeamView } from '@/features/team/team-view';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<{ title: string }> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'business' });
  return { title: t('team.pageTitle') };
}

export default function BusinessTeamPage(): ReactElement {
  return <TeamView />;
}
