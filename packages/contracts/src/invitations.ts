import { z } from 'zod';

import { membershipRoleSchema } from './business.js';
import { localeSchema } from './locale.js';
import { emailSchema } from './primitives.js';

export const invitationStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED']);
export type InvitationStatus = z.infer<typeof invitationStatusSchema>;

/** TTL of an invitation link after create or resend. */
export const INVITATION_TTL_DAYS = 7;

export const createInvitationRequestSchema = z.object({
  email: emailSchema,
  role: membershipRoleSchema,
  staffMemberId: z.string().uuid().optional(),
  locale: localeSchema.optional(),
});

export type CreateInvitationRequest = z.infer<typeof createInvitationRequestSchema>;

export const invitationSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  email: z.string().email(),
  role: membershipRoleSchema,
  staffMemberId: z.string().uuid().nullable(),
  invitedByUserId: z.string().uuid(),
  status: invitationStatusSchema,
  expiresAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Invitation = z.infer<typeof invitationSchema>;

export const invitationListResponseSchema = z.array(invitationSchema);
export type InvitationListResponse = z.infer<typeof invitationListResponseSchema>;

export const invitationPreviewQuerySchema = z.object({
  token: z.string().min(1).max(512),
});

export type InvitationPreviewQuery = z.infer<typeof invitationPreviewQuerySchema>;

export const invitationPreviewResponseSchema = z.object({
  businessName: z.string().min(1),
  logoUrl: z.string().url().nullable(),
  role: membershipRoleSchema,
  inviterDisplayName: z.string().nullable(),
  /** Masked invitee email, e.g. `j***@example.com`. */
  emailMasked: z.string().min(1),
  expiresAt: z.string().datetime(),
});

export type InvitationPreviewResponse = z.infer<typeof invitationPreviewResponseSchema>;

export const acceptInvitationRequestSchema = z.object({
  token: z.string().min(1).max(512),
});

export type AcceptInvitationRequest = z.infer<typeof acceptInvitationRequestSchema>;

export const businessMemberSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  role: membershipRoleSchema,
  staffMemberId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BusinessMember = z.infer<typeof businessMemberSchema>;

export const businessMemberListResponseSchema = z.array(businessMemberSchema);
export type BusinessMemberListResponse = z.infer<typeof businessMemberListResponseSchema>;

export const updateMemberRequestSchema = z
  .object({
    role: membershipRoleSchema.optional(),
    staffMemberId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => v.role !== undefined || v.staffMemberId !== undefined, {
    message: 'At least one of role or staffMemberId is required',
  });

export type UpdateMemberRequest = z.infer<typeof updateMemberRequestSchema>;
