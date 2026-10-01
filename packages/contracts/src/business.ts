import { z } from 'zod';

import { citySchema } from './cities.js';
import { emailSchema } from './primitives.js';

export const membershipRoleSchema = z.enum(['OWNER', 'ADMIN', 'STAFF']);
export type MembershipRole = z.infer<typeof membershipRoleSchema>;

export const businessStatusSchema = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
]);
export type BusinessStatus = z.infer<typeof businessStatusSchema>;

export const confirmationModeSchema = z.enum(['AUTO', 'MANUAL']);
export type ConfirmationMode = z.infer<typeof confirmationModeSchema>;

/** Public URL slug reserved words (must stay in sync with API slug helpers). */
export const RESERVED_BUSINESS_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'business',
  'categories',
  'cities',
  'health',
  'me',
  'new',
  'public',
]);

/** Public URL slug for a business. */
export const businessSlugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be a lowercase kebab-case slug')
  .refine((slug) => !RESERVED_BUSINESS_SLUGS.has(slug), 'slug is reserved');

export type BusinessSlug = z.infer<typeof businessSlugSchema>;

const businessNameSchema = z.string().trim().min(1).max(120);
const optionalText = z.string().trim().min(1).max(2000).optional();
const optionalAddress = z.string().trim().min(1).max(300).optional();
const optionalPhone = z.string().trim().min(3).max(40).optional();
/** Upper bound: one year in minutes (int4-safe; prevents DB overflow). */
const bookingMinutesSchema = z.number().int().min(0).max(525_600);

/** Body of `POST /api/v1/businesses`. */
export const createBusinessRequestSchema = z.object({
  name: businessNameSchema,
  categoryId: z.string().uuid(),
  city: citySchema,
  description: optionalText,
  address: optionalAddress,
  contactPhone: optionalPhone,
  contactEmail: emailSchema.optional(),
  /** When true, creates a StaffMember linked to the OWNER membership (#74). */
  ownerIsStaff: z.boolean().optional(),
});

export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>;

/** Body of `PATCH /api/v1/businesses/:businessId`. */
export const updateBusinessRequestSchema = z
  .object({
    name: businessNameSchema.optional(),
    categoryId: z.string().uuid().optional(),
    city: citySchema.optional(),
    description: z.string().trim().min(1).max(2000).nullable().optional(),
    address: z.string().trim().min(1).max(300).nullable().optional(),
    contactPhone: z.string().trim().min(3).max(40).nullable().optional(),
    contactEmail: emailSchema.nullable().optional(),
    confirmationMode: confirmationModeSchema.optional(),
    cancellationWindowMinutes: bookingMinutesSchema.optional(),
    minBookingNoticeMinutes: bookingMinutesSchema.optional(),
    bookingHorizonDays: z.number().int().min(1).max(365).optional(),
    slug: businessSlugSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

export type UpdateBusinessRequest = z.infer<typeof updateBusinessRequestSchema>;

/** Full business payload for members (`GET` / `POST` / `PATCH`). */
export const businessSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: businessSlugSchema,
  categoryId: z.string().uuid(),
  description: z.string().nullable(),
  timezone: z.literal('Europe/Podgorica'),
  city: citySchema,
  address: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactEmail: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  coverUrl: z.string().url().nullable(),
  confirmationMode: confirmationModeSchema,
  cancellationWindowMinutes: z.number().int(),
  minBookingNoticeMinutes: z.number().int(),
  bookingHorizonDays: z.number().int(),
  status: businessStatusSchema,
  /** Present for members so REJECTED businesses can show the admin reason on the dashboard. */
  rejectionReason: z.string().nullable(),
  myRole: membershipRoleSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Business = z.infer<typeof businessSchema>;

/** One row of `GET /api/v1/me/businesses`. */
export const myBusinessSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1),
  slug: businessSlugSchema,
  status: businessStatusSchema,
  role: membershipRoleSchema,
  /** Linked staff member once #74 lands; null until then. */
  staffMemberId: z.string().uuid().nullable(),
  logoUrl: z.string().url().nullable(),
});

export type MyBusiness = z.infer<typeof myBusinessSchema>;

export const myBusinessesResponseSchema = z.array(myBusinessSchema);

export type MyBusinessesResponse = z.infer<typeof myBusinessesResponseSchema>;
