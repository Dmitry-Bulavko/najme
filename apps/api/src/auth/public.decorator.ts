import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route (or controller) out of the global JWT guard. Use sparingly and deliberately.
 * `@Public(false)` on a route re-protects it inside a `@Public()` controller.
 */
export const Public = (isPublic = true): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, isPublic);
