import { z } from 'zod';

import { businessStatusSchema, businessSlugSchema } from './business.js';
import { citySchema } from './cities.js';
import { paginated, paginationQuerySchema } from './pagination.js';

/** Query for `GET /admin/businesses`. Defaults to pending, oldest first. */
export const adminBusinessListQuerySchema = paginationQuerySchema.extend({
  status: businessStatusSchema.default('PENDING_APPROVAL'),
});

export type AdminBusinessListQuery = z.infer<typeof adminBusinessListQuerySchema>;

/** One row of the admin business queue (counts + owner contact). */
export const adminBusinessListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: businessSlugSchema,
  status: businessStatusSchema,
  city: citySchema,
  categoryId: z.string().uuid(),
  categoryName: z.string().min(1),
  ownerEmail: z.string().email(),
  ownerEmailVerified: z.boolean(),
  staffCount: z.number().int().nonnegative(),
  servicesCount: z.number().int().nonnegative(),
  staffWithWorkingHoursCount: z.number().int().nonnegative(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.string().datetime().nullable(),
  reviewedAt: z.string().datetime().nullable(),
});

export type AdminBusinessListItem = z.infer<typeof adminBusinessListItemSchema>;

export const adminBusinessListResponseSchema = paginated(adminBusinessListItemSchema);
export type AdminBusinessListResponse = z.infer<typeof adminBusinessListResponseSchema>;

/** `GET /admin/businesses/:id` — same shape as a list item for MVP. */
export const adminBusinessDetailSchema = adminBusinessListItemSchema;
export type AdminBusinessDetail = z.infer<typeof adminBusinessDetailSchema>;

export const rejectBusinessRequestSchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

export type RejectBusinessRequest = z.infer<typeof rejectBusinessRequestSchema>;
