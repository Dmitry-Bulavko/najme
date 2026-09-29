import { z } from 'zod';

/**
 * Every error code the API may return. Clients map each code to the `errors.<CODE>` i18n key
 * (`docs/conventions/api.md`). Add new codes here together with `errors.json` in `@najme/i18n`.
 */
export const ERROR_CODES = [
  // Generic
  'VALIDATION_FAILED',
  /** @deprecated Never emitted: every 401 uses `UNAUTHENTICATED` (ADR-0010). Kept for old clients. */
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'UNPROCESSABLE_ENTITY',
  'HTTP_ERROR',
  'INTERNAL_ERROR',
  'SLOT_TAKEN',
  // Auth
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'UNAUTHENTICATED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'PASSWORD_NOT_SET',
  'GOOGLE_SIGN_IN_DISABLED',
  'GOOGLE_TOKEN_INVALID',
  'RATE_LIMITED',
] as const;

/** Union of every known error code. */
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Validates that a value is one of the known {@link ERROR_CODES}. */
export const errorCodeSchema = z.enum(ERROR_CODES);

/**
 * Stable, translatable error code. Clients translate codes via i18n, never by parsing `message`.
 * See `docs/conventions/api.md`.
 */
export const apiErrorCodeSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/, 'must be UPPER_SNAKE_CASE');

// The envelope stays format-based (not `errorCodeSchema`) so a client still parses a response
// carrying a code newer than its bundled contracts; use `errorCodeSchema` to narrow to known codes.

/**
 * The body of every non-2xx API response, as defined in `docs/conventions/api.md`:
 *
 * ```json
 * { "error": { "code": "SLOT_TAKEN", "message": "...", "details": {} } }
 * ```
 */
export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const apiErrorResponseSchema = z.object({
  error: apiErrorSchema,
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
