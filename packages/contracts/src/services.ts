import { z } from 'zod';

import { moneySchema } from './money.js';

export const customFieldTypeSchema = z.enum(['TEXT', 'NUMBER', 'SELECT']);
export type CustomFieldType = z.infer<typeof customFieldTypeSchema>;

const step5 = (n: number) => n % 5 === 0;

const durationMinutesSchema = z
  .number()
  .int()
  .min(5)
  .max(720)
  .refine(step5, { message: 'must be a multiple of 5' });

const bufferMinutesSchema = z
  .number()
  .int()
  .min(0)
  .max(240)
  .refine(step5, { message: 'must be a multiple of 5' });

/** EUR service prices; amount capped to stay within PostgreSQL int4. */
const eurPriceSchema = moneySchema
  .refine((m) => m.currency === 'EUR' && m.amount >= 0, {
    message: 'price must be non-negative EUR',
  })
  .refine((m) => m.amount <= 99_999_999, {
    message: 'price amount must be at most 99999999',
  });

const customFieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, 'must match ^[a-z][a-z0-9_]{0,39}$');

/** SELECT option: stable `value` + display `label` (data-model / AC 8). */
export const selectOptionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(80),
});

export type SelectOption = z.infer<typeof selectOptionSchema>;

export const serviceCustomFieldSchema = z
  .object({
    key: customFieldKeySchema,
    label: z.string().trim().min(1).max(80),
    type: customFieldTypeSchema,
    required: z.boolean(),
    options: z.array(selectOptionSchema).max(20).optional(),
    sortOrder: z.number().int().min(0).max(99).optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type === 'SELECT') {
      const options = field.options ?? [];
      if (options.length < 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'SELECT fields need 1–20 options',
          path: ['options'],
        });
        return;
      }
      const values = options.map((o) => o.value);
      if (new Set(values).size !== values.length) {
        ctx.addIssue({
          code: 'custom',
          message: 'SELECT option values must be unique',
          path: ['options'],
        });
      }
    } else if (field.options !== undefined && field.options.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'options are only allowed for SELECT',
        path: ['options'],
      });
    }
  });

export type ServiceCustomField = z.infer<typeof serviceCustomFieldSchema>;

const customFieldsSchema = z
  .array(serviceCustomFieldSchema)
  .max(10)
  .superRefine((fields, ctx) => {
    const seen = new Map<string, number>();
    fields.forEach((field, index) => {
      const prev = seen.get(field.key);
      if (prev !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: 'custom field keys must be unique',
          path: [index, 'key'],
        });
      } else {
        seen.set(field.key, index);
      }
    });
  });

const staffMemberIdsSchema = z
  .array(z.string().uuid())
  .max(100)
  .superRefine((ids, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'staffMemberIds must be unique' });
    }
  });

/** Shared writable fields for create/update (without replace-set lists). */
const serviceWritableBaseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(1000).nullable().optional(),
  durationMinutes: durationMinutesSchema,
  bufferBeforeMinutes: bufferMinutesSchema.optional(),
  bufferAfterMinutes: bufferMinutesSchema.optional(),
  price: eurPriceSchema,
  minBookingNoticeMinutes: z.number().int().min(0).max(525_600).nullable().optional(),
  bookingHorizonDays: z.number().int().min(1).max(365).nullable().optional(),
  active: z.boolean().optional(),
  staffMemberIds: staffMemberIdsSchema.optional(),
  customFields: customFieldsSchema.optional(),
});

export const createServiceRequestSchema = serviceWritableBaseSchema;

export type CreateServiceRequest = z.infer<typeof createServiceRequestSchema>;

export const updateServiceRequestSchema = serviceWritableBaseSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

export type UpdateServiceRequest = z.infer<typeof updateServiceRequestSchema>;

export const serviceCustomFieldResponseSchema = z.object({
  id: z.string().uuid(),
  key: customFieldKeySchema,
  label: z.string().min(1),
  type: customFieldTypeSchema,
  required: z.boolean(),
  options: z.array(selectOptionSchema).nullable(),
  sortOrder: z.number().int(),
});

export type ServiceCustomFieldResponse = z.infer<typeof serviceCustomFieldResponseSchema>;

export const serviceSchema = z.object({
  id: z.string().uuid(),
  businessId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  durationMinutes: z.number().int(),
  bufferBeforeMinutes: z.number().int(),
  bufferAfterMinutes: z.number().int(),
  price: eurPriceSchema,
  minBookingNoticeMinutes: z.number().int().nullable(),
  bookingHorizonDays: z.number().int().nullable(),
  active: z.boolean(),
  staffMemberIds: z.array(z.string().uuid()),
  customFields: z.array(serviceCustomFieldResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Service = z.infer<typeof serviceSchema>;

export const servicesResponseSchema = z.array(serviceSchema);
export type ServicesResponse = z.infer<typeof servicesResponseSchema>;
