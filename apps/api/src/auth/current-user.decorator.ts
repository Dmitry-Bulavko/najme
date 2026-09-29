import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types.js';

/** The authenticated user set by {@link JwtAuthGuard}; only valid on non-public routes. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
  return request.user;
});
