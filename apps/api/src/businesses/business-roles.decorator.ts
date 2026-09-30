import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@najme/contracts';

export const BUSINESS_ROLES_KEY = 'businessRoles';

/** Roles allowed on a business-scoped handler. Empty means any member. */
export function BusinessRoles(...roles: MembershipRole[]) {
  return SetMetadata(BUSINESS_ROLES_KEY, roles);
}
