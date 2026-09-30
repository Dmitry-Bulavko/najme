import { z } from 'zod';

import { localeSchema } from './locale.js';
import { displayNameSchema, passwordSchema } from './primitives.js';

/** The current user's profile, as returned by `GET /users/me` and inside `authSession`. */
export const meSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  emailVerified: z.boolean(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  locale: localeSchema,
  hasPassword: z.boolean(),
  /** Platform-admin capability (flag, not a membership role). */
  isPlatformAdmin: z.boolean(),
});

export type Me = z.infer<typeof meSchema>;

/** `PATCH /me` body. At least one field is required. */
export const updateProfileRequestSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    locale: localeSchema.optional(),
  })
  .refine((value) => value.displayName !== undefined || value.locale !== undefined, {
    message: 'At least one of displayName or locale is required',
  });

export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

/** `POST /me/password` body. */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
