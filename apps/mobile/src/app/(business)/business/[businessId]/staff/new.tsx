import type { ReactElement } from 'react';

import { StaffForm } from '@/features/staff/staff-form';

export default function BusinessStaffNewScreen(): ReactElement {
  return <StaffForm mode="create" />;
}
