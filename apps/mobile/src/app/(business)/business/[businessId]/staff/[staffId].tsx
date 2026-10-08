import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { StaffForm } from '@/features/staff/staff-form';

export default function BusinessStaffEditScreen(): ReactElement {
  const { staffId, created } = useLocalSearchParams<{ staffId: string; created?: string }>();
  return <StaffForm mode="edit" staffId={staffId} showCreatedBanner={created === '1'} />;
}
