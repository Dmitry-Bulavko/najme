import type { MembershipRole } from '@najme/contracts';

/** Membership resolved by {@link BusinessAccessGuard} for the current request. */
export type BusinessMembership = {
  id: string;
  userId: string;
  businessId: string;
  role: MembershipRole;
};

export const BUSINESS_MEMBERSHIP_KEY = 'businessMembership';
export const BUSINESS_ID_PARAM = 'businessId';
