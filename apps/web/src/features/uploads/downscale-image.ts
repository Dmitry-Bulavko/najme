import type { UploadContentType } from '@najme/contracts';
import { UPLOAD_MAX_BYTES, uploadContentTypeSchema } from '@najme/contracts';

export const IMAGE_MAX_EDGE_PX = 1600;

const ALLOWED_TYPES = new Set(uploadContentTypeSchema.options);

export type PreparedUpload = {
  blob: Blob;
  contentType: UploadContentType;
  fileName: string;
};

/** Rejects unsupported MIME types and empty / oversized files before canvas work. */
export function assertUploadableImage(file: File): UploadContentType {
  const parsed = uploadContentTypeSchema.safeParse(file.type);
  if (!parsed.success || !ALLOWED_TYPES.has(file.type as UploadContentType)) {
    throw new Error('UPLOAD_TYPE');
  }
  if (file.size < 1 || file.size > UPLOAD_MAX_BYTES) {
    throw new Error('UPLOAD_SIZE');
  }
  return parsed.data;
}

/**
 * Loads `file` into a canvas, scales so the longest edge is ≤ `maxEdge`, and returns a blob
 * in the original content type (JPEG quality 0.9).
 */
export async function downscaleImageFile(
  file: File,
  maxEdge: number = IMAGE_MAX_EDGE_PX,
): Promise<PreparedUpload> {
  const contentType = assertUploadableImage(file);
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('UPLOAD_CANVAS');
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error('UPLOAD_CANVAS'));
            return;
          }
          resolve(result);
        },
        contentType,
        contentType === 'image/jpeg' ? 0.9 : undefined,
      );
    });
    if (blob.size < 1 || blob.size > UPLOAD_MAX_BYTES) {
      throw new Error('UPLOAD_SIZE');
    }
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    return { blob, contentType, fileName: `upload.${ext}` };
  } finally {
    bitmap.close();
  }
}
