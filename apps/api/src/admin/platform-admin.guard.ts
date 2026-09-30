import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { apiError } from '../common/errors/api-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

type AuthedRequest = Request & { user?: { id: string } };

/**
 * Re-reads `User.isPlatformAdmin` from the DB on every request so revoke takes effect
 * immediately (JWT alone is not enough).
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.user?.id;
    if (!userId) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required.');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { isPlatformAdmin: true },
    });
    if (!user?.isPlatformAdmin) {
      throw apiError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Platform admin access required.');
    }
    return true;
  }
}
