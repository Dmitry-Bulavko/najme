import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { apiError } from '../common/errors/api-error.js';
import { AccessTokenService } from './access-token.service.js';
import type { AuthenticatedUser } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

/**
 * Registered globally: every route requires `Authorization: Bearer <accessToken>` unless it is
 * marked `@Public()`. The guard checks the signature and expiry only (no DB lookup); see ADR-0010
 * for the resulting window after an account is wiped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AccessTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    const userId =
      scheme?.toLowerCase() === 'bearer' && token ? await this.tokens.verify(token) : null;
    if (!userId) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    request.user = { id: userId };
    return true;
  }
}
