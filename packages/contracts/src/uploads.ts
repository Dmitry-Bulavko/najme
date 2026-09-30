import { z } from 'zod';

export const uploadKindSchema = z.enum(['LOGO', 'COVER', 'STAFF_PHOTO']);
export type UploadKind = z.infer<typeof uploadKindSchema>;

export const uploadContentTypeSchema = z.enum(['image/jpeg', 'image/png', 'image/webp']);
export type UploadContentType = z.infer<typeof uploadContentTypeSchema>;

/** Max upload size: 5 MiB. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

export const createUploadRequestSchema = z.object({
  kind: uploadKindSchema,
  contentType: uploadContentTypeSchema,
  contentLength: z.number().int().min(1).max(UPLOAD_MAX_BYTES),
});

export type CreateUploadRequest = z.infer<typeof createUploadRequestSchema>;

export const createUploadResponseSchema = z.object({
  key: z.string().min(1),
  url: z.string().url(),
  fields: z.record(z.string(), z.string()),
  expiresAt: z.string().datetime(),
});

export type CreateUploadResponse = z.infer<typeof createUploadResponseSchema>;

export const attachUploadRequestSchema = z.object({
  key: z.string().min(1).max(512),
});

export type AttachUploadRequest = z.infer<typeof attachUploadRequestSchema>;
