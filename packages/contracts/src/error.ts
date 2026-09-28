import { z } from 'zod';

/**
 * Stable, translatable error code. Clients translate codes via i18n, never by parsing `message`.
 * See `docs/conventions/api.md`.
 */
export const apiErrorCodeSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/, 'must be UPPER_SNAKE_CASE');

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
