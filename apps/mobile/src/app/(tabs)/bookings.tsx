import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/features/placeholder-screen';

/** Bookings tab placeholder (real screen lands once booking flows exist). */
export default function BookingsScreen(): ReactElement {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t('screens.bookings.title')} body={t('screens.bookings.body')} />
  );
}
