import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { ServiceForm } from '@/features/services/service-form';

export default function BusinessServicesEditScreen(): ReactElement {
  const { serviceId, created } = useLocalSearchParams<{ serviceId: string; created?: string }>();
  return <ServiceForm mode="edit" serviceId={serviceId} showCreatedBanner={created === '1'} />;
}
