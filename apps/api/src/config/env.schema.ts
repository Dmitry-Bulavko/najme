import { z } from 'zod';

/**
 * Startup environment configuration, validated with zod (ADR-0002). Invalid or missing values make
 * the process exit with a clear message instead of starting in a broken state.
 */
/** An optional string where "" (an unset compose `${VAR:-}`) means "not set". */
const optionalNonEmpty = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(1).optional(),
);

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
    /** SMTP relay for transactional email: Mailpit in dev and CI, a provider later (M5). */
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    /**
     * Both or neither; unset means an unauthenticated relay (Mailpit). Empty counts as unset, since
     * `infra/compose.prod.yml` passes `${SMTP_USER:-}` through as "".
     */
    SMTP_USER: optionalNonEmpty,
    SMTP_PASSWORD: optionalNonEmpty,
    /** Sender shown to recipients, e.g. `Najme <no-reply@example.com>`. */
    MAIL_FROM: z.string().min(3),
    /**
     * Comma-separated public OAuth client IDs (web, iOS, Android) accepted as the `aud` of Google
     * ID tokens (ADR-0010). Not a secret. Unset or empty disables Google sign-in.
     */
    GOOGLE_CLIENT_IDS: z.string().optional(),
    /** Origin of the web app; base of the links in emails (`${APP_WEB_URL}/<locale>/...`). */
    APP_WEB_URL: z.url(),
  })
  .refine((env) => (env.SMTP_USER === undefined) === (env.SMTP_PASSWORD === undefined), {
    message: 'SMTP_USER and SMTP_PASSWORD must be set together',
    path: ['SMTP_PASSWORD'],
  })
  .transform((env) => ({
    ...env,
    GOOGLE_CLIENT_IDS: (env.GOOGLE_CLIENT_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
    AUTH_COOKIE_SECURE: env.AUTH_COOKIE_SECURE ?? env.NODE_ENV !== 'development',
    // No trailing slash, so links can be built with a plain `${APP_WEB_URL}/...`.
    APP_WEB_URL: env.APP_WEB_URL.replace(/\/+$/, ''),
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
