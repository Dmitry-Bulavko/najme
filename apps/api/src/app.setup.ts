import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';

export const API_PREFIX = 'api/v1';

/**
 * Wiring shared by `main.ts` and the e2e tests, so tests exercise the production setup.
 * `trust proxy` = 1: the API sits behind exactly one proxy (Caddy, ADR-0007), so `req.ip` (used by
 * the rate limiter) is the real client address taken from `X-Forwarded-For`.
 */
export function configureApp(app: INestApplication): void {
  (app as NestExpressApplication).set('trust proxy', 1);
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new ApiExceptionFilter());
}
