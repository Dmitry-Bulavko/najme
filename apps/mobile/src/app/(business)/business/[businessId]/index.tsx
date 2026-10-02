import type { ReactElement } from 'react';

import { Screen } from '@/components/ui';
import { BusinessOverview } from '@/features/business/business-overview';

/** Business overview tab: status banner + setup checklist. */
export default function BusinessOverviewScreen(): ReactElement {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <BusinessOverview />
    </Screen>
  );
}
