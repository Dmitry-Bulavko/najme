import { useLocalSearchParams } from 'expo-router';
import type { ReactElement } from 'react';

import { StaffScheduleView } from '@/features/schedule/staff-schedule-view';

export default function BusinessStaffScheduleScreen(): ReactElement {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  return <StaffScheduleView staffId={staffId} />;
}
