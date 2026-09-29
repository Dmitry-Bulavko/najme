import { z } from 'zod';

/**
 * Startup environment configuration, validated with zod (ADR-0002). Invalid or missing values make
 * the process exit with a clear message instead of starting in a broken state.
 */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.url({ protocol: /^postgresql|postgres$/ }),
    GIT_SHA: z.string().min(1).optional(),
    PUBLIC_URL: z.url().optional(),
    /** HS256 key for access tokens (ADR-0010). Generate with `openssl rand -base64 48`. */
    JWT_ACCESS_SECRET: z.string().min(32),
    /** Whether the refresh cookie carries `Secure`; defaults to on everywhere but development. */
    AUTH_COOKIE_SECURE: z.stringbool().optional(),
  })
  .transform((env) => ({
    ...env,
    AUTH_COOKIE_SECURE: env.AUTH_COOKIE_SECURE ?? env.NODE_ENV !== 'development',
  }));

export type Env = z.infer<typeof envSchema>;

/**
 * Parses `process.env` and exits the process with a readable error when it is invalid, instead of
 * throwing deep inside Nest's DI graph.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error('Invalid environment configuration:', z.treeifyError(result.error));
    process.exit(1);
  }
  return result.data;
}
