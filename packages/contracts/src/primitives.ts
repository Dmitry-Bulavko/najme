import { z } from 'zod';

/** New password: 8–128 characters. */
export const passwordSchema = z.string().min(8).max(128);

/** Email: trimmed, then lowercased, then validated. */
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Display name: trimmed, 1–100 chars. */
export const displayNameSchema = z.string().trim().min(1).max(100);
