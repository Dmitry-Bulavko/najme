import { z } from 'zod';

import { localeSchema } from './locale.js';
import { displayNameSchema, emailSchema, passwordSchema } from './primitives.js';
import { meSchema } from './users.js';

/** Opaque one-time token (email verification, password reset). */
const tokenSchema = z.string().min(1).max(512);

export const registerRequestSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: displayNameSchema.optional(),
  locale: localeSchema.optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: emailSchema,
  // No length bounds beyond non-empty: never reveal password policy on login.
  password: z.string().min(1).max(128),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Refresh body. `refreshToken` is only sent by mobile; web uses the httpOnly cookie (ADR-0010). */
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const googleSignInRequestSchema = z.object({
  idToken: z.string().min(1),
  locale: localeSchema.optional(),
});
export type GoogleSignInRequest = z.infer<typeof googleSignInRequestSchema>;

export const verifyEmailRequestSchema = z.object({ token: tokenSchema });
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;

export const forgotPasswordRequestSchema = z.object({ email: emailSchema });
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: tokenSchema,
  newPassword: passwordSchema,
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

/** Successful sign-in/refresh response. `refreshToken` is in the body for mobile only. */
export const authSessionSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string().min(1).optional(),
  user: meSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;
