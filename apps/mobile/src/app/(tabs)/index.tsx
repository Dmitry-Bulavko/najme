import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/placeholder-screen';

/** Discover tab placeholder (real screen lands in M1 — business/service discovery). */
export default function DiscoverScreen(): ReactElement {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t('screens.discover.title')} body={t('screens.discover.body')} />
  );
}
