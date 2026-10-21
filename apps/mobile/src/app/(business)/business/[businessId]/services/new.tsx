import type { ReactElement } from 'react';

import { ServiceForm } from '@/features/services/service-form';

export default function BusinessServicesNewScreen(): ReactElement {
  return <ServiceForm mode="create" />;
}
