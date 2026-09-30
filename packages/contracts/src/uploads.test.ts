import { describe, expect, it } from 'vitest';
import {
  UPLOAD_MAX_BYTES,
  attachBusinessImageResponseSchema,
  attachStaffPhotoResponseSchema,
  attachUploadRequestSchema,
  createUploadRequestSchema,
  createUploadResponseSchema,
} from './uploads.js';

describe('uploads contracts', () => {
  it('accepts a valid create-upload request and response', () => {
    const req = createUploadRequestSchema.parse({
      kind: 'LOGO',
      contentType: 'image/png',
      contentLength: 1024,
    });
    expect(req.contentLength).toBe(1024);

    const res = createUploadResponseSchema.parse({
      key: 'businesses/x/logo/y.png',
      url: 'http://localhost:9000/najme',
      fields: { key: 'businesses/x/logo/y.png', 'Content-Type': 'image/png' },
      expiresAt: '2026-06-15T12:10:00.000Z',
    });
    expect(res.fields['Content-Type']).toBe('image/png');
  });

  it('rejects oversized or disallowed create-upload bodies', () => {
    expect(() =>
      createUploadRequestSchema.parse({
        kind: 'LOGO',
        contentType: 'image/gif',
        contentLength: 10,
      }),
    ).toThrow();
    expect(() =>
      createUploadRequestSchema.parse({
        kind: 'LOGO',
        contentType: 'image/png',
        contentLength: UPLOAD_MAX_BYTES + 1,
      }),
    ).toThrow();
    expect(() =>
      createUploadRequestSchema.parse({
        kind: 'LOGO',
        contentType: 'image/png',
        contentLength: 0,
      }),
    ).toThrow();
  });

  it('parses attach request and response shapes', () => {
    expect(attachUploadRequestSchema.parse({ key: 'businesses/a/logo/b.png' }).key).toContain(
      'logo',
    );
    expect(
      attachBusinessImageResponseSchema.parse({
        logoUrl: 'http://localhost:9000/najme/a.png',
        coverUrl: null,
      }).coverUrl,
    ).toBeNull();
    expect(
      attachStaffPhotoResponseSchema.parse({
        photoUrl: 'http://localhost:9000/najme/s.webp',
      }).photoUrl,
    ).toMatch(/s\.webp$/);
  });
});
