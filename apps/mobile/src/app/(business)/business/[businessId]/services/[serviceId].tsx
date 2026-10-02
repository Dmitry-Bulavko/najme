import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { ServiceForm } from '@/features/services/service-form';

export default function BusinessServicesEditScreen(): ReactElement {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  return <ServiceForm mode="edit" serviceId={serviceId} />;
}
