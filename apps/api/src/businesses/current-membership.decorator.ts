import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { BUSINESS_MEMBERSHIP_KEY, type BusinessMembership } from './business-access.types.js';

/** Membership attached by {@link BusinessAccessGuard}. */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): BusinessMembership => {
    const req = ctx.switchToHttp().getRequest<{ [BUSINESS_MEMBERSHIP_KEY]?: BusinessMembership }>();
    const membership = req[BUSINESS_MEMBERSHIP_KEY];
    if (!membership) {
      throw new Error('CurrentMembership used without BusinessAccessGuard');
    }
    return membership;
  },
);
