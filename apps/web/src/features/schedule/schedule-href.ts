import type { MembershipRole } from '@najme/contracts';

/**
 * Resolve the Schedule nav / checklist target.
 * STAFF → linked staff member schedule; OWNER/ADMIN → staff picker.
 * Returns null when STAFF has no linked staffMemberId.
 */
export function resolveScheduleHref(
  locale: string,
  businessId: string,
  role: MembershipRole,
  staffMemberId: string | null | undefined,
): string | null {
  const base = `/${locale}/business/${businessId}`;
  if (role === 'STAFF') {
    if (!staffMemberId) return null;
    return `${base}/staff/${staffMemberId}/schedule`;
  }
  return `${base}/schedule`;
}

export function staffScheduleHref(locale: string, businessId: string, staffId: string): string {
  return `/${locale}/business/${businessId}/staff/${staffId}/schedule`;
}

/** Whether the current path is the schedule surface for the role. */
export function isSchedulePathActive(
  pathname: string,
  locale: string,
  businessId: string,
  role: MembershipRole,
  staffMemberId: string | null | undefined,
): boolean {
  const href = resolveScheduleHref(locale, businessId, role, staffMemberId);
  if (!href) return false;
  if (role === 'STAFF') {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  const picker = `/${locale}/business/${businessId}/schedule`;
  const staffSchedulePrefix = `/${locale}/business/${businessId}/staff/`;
  return (
    pathname === picker ||
    pathname.startsWith(`${picker}/`) ||
    (pathname.startsWith(staffSchedulePrefix) && pathname.endsWith('/schedule'))
  );
}
