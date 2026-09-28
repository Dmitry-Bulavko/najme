import { Global, Module } from '@nestjs/common';
import { ENV } from './env.token.js';
import { loadEnv } from './env.schema.js';

/**
 * Exposes the validated startup environment ({@link import('./env.schema.js').Env}) as an
 * injectable value (`ENV` token) so services never read `process.env` directly (ADR-0002).
 * Global so every feature module can inject it without re-importing this module.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
