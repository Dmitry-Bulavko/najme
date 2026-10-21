import { z } from 'zod';

const displayNameSchema = z.string().trim().min(1).max(120);

/** One staff member of a business. */
export const staffMemberSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  displayName: z.string().min(1),
  photoUrl: z.string().url().nullable(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type StaffMember = z.infer<typeof staffMemberSchema>;

export const staffMembersResponseSchema = z.array(staffMemberSchema);
export type StaffMembersResponse = z.infer<typeof staffMembersResponseSchema>;

export const createStaffMemberRequestSchema = z.object({
  displayName: displayNameSchema,
  active: z.boolean().optional(),
});

export type CreateStaffMemberRequest = z.infer<typeof createStaffMemberRequestSchema>;

export const updateStaffMemberRequestSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

export type UpdateStaffMemberRequest = z.infer<typeof updateStaffMemberRequestSchema>;
