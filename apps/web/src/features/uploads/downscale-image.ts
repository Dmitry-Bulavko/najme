import type { UploadContentType } from '@najme/contracts';
import { UPLOAD_MAX_BYTES, uploadContentTypeSchema } from '@najme/contracts';

export const IMAGE_MAX_EDGE_PX = 1600;
/** Sanity cap before decode — output must still be ≤ `UPLOAD_MAX_BYTES`. */
export const IMAGE_INPUT_MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_TYPES = new Set(uploadContentTypeSchema.options);

export type PreparedUpload = {
  blob: Blob;
  contentType: UploadContentType;
  fileName: string;
};

/** Rejects unsupported MIME types and empty / huge inputs before canvas work. */
export function assertUploadableImage(file: File): UploadContentType {
  const parsed = uploadContentTypeSchema.safeParse(file.type);
  if (!parsed.success || !ALLOWED_TYPES.has(file.type as UploadContentType)) {
    throw new Error('UPLOAD_TYPE');
  }
  if (file.size < 1 || file.size > IMAGE_INPUT_MAX_BYTES) {
    throw new Error('UPLOAD_INPUT_SIZE');
  }
  return parsed.data;
}

function extFor(contentType: UploadContentType): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error('UPLOAD_CANVAS'));
          return;
        }
        resolve(result);
      },
      type,
      quality,
    );
  });
}

/** JPEG has no alpha — composite onto white so transparent PNG/WebP pixels are not black. */
function paintWhiteUnder(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

async function canvasToJpeg(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  quality: number,
): Promise<Blob> {
  paintWhiteUnder(canvas, ctx);
  return canvasToBlob(canvas, 'image/jpeg', quality);
}

async function decodeBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (err) {
    // Older engines reject the options bag with TypeError; retry without it.
    if (err instanceof TypeError) {
      try {
        return await createImageBitmap(file);
      } catch (retryErr) {
        throw new Error('UPLOAD_TYPE', { cause: retryErr });
      }
    }
    throw new Error('UPLOAD_TYPE', { cause: err });
  }
}

/**
 * Loads `file` into a canvas, scales so the longest edge is ≤ `maxEdge` (never upscales),
 * and returns a blob. Applies `UPLOAD_MAX_BYTES` to the **output**; oversized PNG photos are
 * re-encoded as JPEG. EXIF orientation is applied via `imageOrientation: 'from-image'`.
 */
export async function downscaleImageFile(
  file: File,
  maxEdge: number = IMAGE_MAX_EDGE_PX,
): Promise<PreparedUpload> {
  const requestedType = assertUploadableImage(file);
  const bitmap = await decodeBitmap(file);

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

    let contentType: UploadContentType = requestedType;
    let blob =
      contentType === 'image/jpeg'
        ? await canvasToJpeg(canvas, ctx, 0.9)
        : await canvasToBlob(canvas, contentType);

    // Older Safari may silently fall back to PNG when asked for WebP.
    if (contentType === 'image/webp' && blob.type && blob.type !== 'image/webp') {
      contentType = 'image/jpeg';
      blob = await canvasToJpeg(canvas, ctx, 0.9);
    }

    // Photos saved as PNG often grow on re-encode; switch to JPEG when still too large.
    if (blob.size > UPLOAD_MAX_BYTES && contentType === 'image/png') {
      contentType = 'image/jpeg';
      blob = await canvasToJpeg(canvas, ctx, 0.85);
    }

    if (blob.size > UPLOAD_MAX_BYTES && contentType === 'image/jpeg') {
      blob = await canvasToJpeg(canvas, ctx, 0.7);
    }

    if (blob.size < 1 || blob.size > UPLOAD_MAX_BYTES) {
      throw new Error('UPLOAD_SIZE');
    }

    const typed = uploadContentTypeSchema.safeParse(blob.type);
    if (typed.success) {
      contentType = typed.data;
    }

    return { blob, contentType, fileName: `upload.${extFor(contentType)}` };
  } finally {
    bitmap.close();
  }
}
