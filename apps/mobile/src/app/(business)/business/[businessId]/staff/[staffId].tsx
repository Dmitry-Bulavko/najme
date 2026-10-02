import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { StaffForm } from '@/features/staff/staff-form';

export default function BusinessStaffEditScreen(): ReactElement {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  return <StaffForm mode="edit" staffId={staffId} />;
}
