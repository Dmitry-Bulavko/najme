import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui';

/** Services list stub — full editor lands in a later mobile task. */
export default function BusinessServicesStubScreen(): ReactElement {
  const { t } = useTranslation('business');
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <EmptyState icon="cut-outline" message={t('services.heading')} hint={t('shell.comingSoon')} />
    </Screen>
  );
}
