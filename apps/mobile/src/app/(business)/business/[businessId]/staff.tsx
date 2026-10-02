import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui';

/** Staff list stub — full editor lands in a later mobile task. */
export default function BusinessStaffStubScreen(): ReactElement {
  const { t } = useTranslation('business');
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <EmptyState icon="people-outline" message={t('staff.heading')} hint={t('shell.comingSoon')} />
    </Screen>
  );
}
