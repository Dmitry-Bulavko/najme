import type { ReactElement } from 'react';

import { Screen } from '@/components/ui';
import { BusinessSettingsForm } from '@/features/business/business-settings-form';

/** Booking policy settings (OWNER/ADMIN). Delete stays web-only. */
export default function BusinessSettingsScreen(): ReactElement {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <BusinessSettingsForm />
    </Screen>
  );
}
