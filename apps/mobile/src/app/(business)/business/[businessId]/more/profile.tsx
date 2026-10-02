import type { ReactElement } from 'react';

import { Screen } from '@/components/ui';
import { BusinessProfileForm } from '@/features/business/business-profile-form';

/** Business profile (editable for OWNER/ADMIN, read-only for STAFF). */
export default function BusinessProfileScreen(): ReactElement {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <BusinessProfileForm />
    </Screen>
  );
}
