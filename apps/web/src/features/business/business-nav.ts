import type { MembershipRole } from '@najme/contracts';

export type BusinessNavKey =
  'overview' | 'staff' | 'services' | 'schedule' | 'team' | 'profile' | 'settings';

export type BusinessNavItem = {
  key: BusinessNavKey;
  /** Path segment under `/business/[businessId]/`. Empty string = overview. */
  segment: string;
  /** i18n key under `business.shell`. */
  labelKey: BusinessNavKey;
  /** Roles that see this item. */
  roles: readonly MembershipRole[];
  /**
   * When true, href is resolved at render time (STAFF → own staff schedule;
   * OWNER/ADMIN → schedule picker). See `resolveScheduleHref`.
   */
  dynamicHref?: 'schedule';
};

/** Role-aware business dashboard nav (ADR-0013: STAFF skip Team and Settings). */
export const BUSINESS_NAV: readonly BusinessNavItem[] = [
  { key: 'overview', segment: '', labelKey: 'overview', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { key: 'staff', segment: 'staff', labelKey: 'staff', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  {
    key: 'services',
    segment: 'services',
    labelKey: 'services',
    roles: ['OWNER', 'ADMIN', 'STAFF'],
  },
  {
    key: 'schedule',
    segment: 'schedule',
    labelKey: 'schedule',
    roles: ['OWNER', 'ADMIN', 'STAFF'],
    dynamicHref: 'schedule',
  },
  { key: 'team', segment: 'team', labelKey: 'team', roles: ['OWNER', 'ADMIN'] },
  { key: 'profile', segment: 'profile', labelKey: 'profile', roles: ['OWNER', 'ADMIN', 'STAFF'] },
  { key: 'settings', segment: 'settings', labelKey: 'settings', roles: ['OWNER', 'ADMIN'] },
] as const;

export function navItemsForRole(role: MembershipRole): BusinessNavItem[] {
  return BUSINESS_NAV.filter((item) => item.roles.includes(role));
}

export function businessHref(locale: string, businessId: string, segment: string): string {
  const base = `/${locale}/business/${businessId}`;
  return segment ? `${base}/${segment}` : base;
}
