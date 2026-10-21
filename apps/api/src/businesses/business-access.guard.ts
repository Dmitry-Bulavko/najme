import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MembershipRole } from '@najme/contracts';
import type { Request } from 'express';
import { z } from 'zod';
import { apiError } from '../common/errors/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BUSINESS_ROLES_KEY } from './business-roles.decorator.js';
import {
  BUSINESS_ID_PARAM,
  BUSINESS_MEMBERSHIP_KEY,
  type BusinessMembership,
} from './business-access.types.js';

type AuthedRequest = Request & {
  user?: { id: string };
  [BUSINESS_MEMBERSHIP_KEY]?: BusinessMembership;
};

const businessIdSchema = z.string().uuid();

/**
 * Resolves business membership before body validation.
 * Unknown / deleted / non-member / malformed id → 404; wrong role → 403.
 */
@Injectable()
export class BusinessAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.id;
    if (!userId) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const rawBusinessId = req.params[BUSINESS_ID_PARAM];
    const businessId = typeof rawBusinessId === 'string' ? rawBusinessId : rawBusinessId?.[0];
    if (!businessId || !businessIdSchema.safeParse(businessId).success) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        businessId,
        business: { deletedAt: null },
      },
      select: {
        id: true,
        userId: true,
        businessId: true,
        role: true,
      },
    });

    if (!membership) {
      throw apiError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Business not found.');
    }

    const allowed = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(
      BUSINESS_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Missing @BusinessRoles is a programming error — never fail open to any member.
    if (allowed === undefined) {
      throw apiError(
        HttpStatus.INTERNAL_SERVER_ERROR,
        'INTERNAL_ERROR',
        'BusinessRoles metadata is required on business-scoped handlers.',
      );
    }

    if (allowed.length > 0 && !allowed.includes(membership.role)) {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Insufficient role for this business.');
    }

    const resolved: BusinessMembership = {
      id: membership.id,
      userId: membership.userId,
      businessId: membership.businessId,
      role: membership.role,
    };
    req[BUSINESS_MEMBERSHIP_KEY] = resolved;
    return true;
  }
}
