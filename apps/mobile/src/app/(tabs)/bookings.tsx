import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui';

/** Bookings tab placeholder (real screen lands once booking flows exist). */
export default function BookingsScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile']);
  return (
    <Screen>
      <EmptyState
        icon="calendar-outline"
        message={t('common:screens.bookings.body')}
        hint={t('mobile:empty.bookings')}
      />
    </Screen>
  );
}
