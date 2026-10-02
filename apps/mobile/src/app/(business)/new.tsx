import type { ReactElement } from 'react';

import { Screen } from '@/components/ui';
import { CreateBusinessForm } from '@/features/business/create-business-form';

/** Create a new business (parity with web `/business/new`). */
export default function CreateBusinessScreen(): ReactElement {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <CreateBusinessForm />
    </Screen>
  );
}
