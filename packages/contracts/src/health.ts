import { z } from 'zod';

/**
 * Response of `GET /api/v1/health`, see `docs/conventions/api.md`.
 */
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['ok', 'error']),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
