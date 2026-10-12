import type { MembershipRole } from '@najme/contracts';

import { businessHref } from '@/features/business/last-business';

/**
 * Resolve the Schedule tab / checklist target.
 * STAFF → linked staff member schedule; OWNER/ADMIN → staff picker.
 * Returns null when STAFF has no linked staffMemberId.
 */
export function resolveScheduleHref(
  businessId: string,
  role: MembershipRole,
  staffMemberId: string | null | undefined,
): `/(business)/business/${string}` | null {
  if (role === 'STAFF') {
    if (!staffMemberId) return null;
    return staffScheduleHref(businessId, staffMemberId);
  }
  return businessHref(businessId, '/schedule');
}

export function staffScheduleHref(
  businessId: string,
  staffId: string,
): `/(business)/business/${string}` {
  return businessHref(businessId, `/schedule/${staffId}`);
}
