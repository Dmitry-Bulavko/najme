import { UPLOAD_MAX_BYTES } from '@najme/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  IMAGE_INPUT_MAX_BYTES,
  assertUploadableImage,
  downscaleImageFile,
} from './downscale-image';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function fileWithSize(bytes: number, name: string, type: string): File {
  const file = new File([new Uint8Array(Math.min(bytes, 16))], name, { type });
  Object.defineProperty(file, 'size', { value: bytes });
  return file;
}

function mockBitmap(width: number, height: number) {
  return {
    width,
    height,
    close: vi.fn(),
  };
}

function stubCanvas(blobs: Blob[]) {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const save = vi.fn();
  const restore = vi.fn();
  const ctx = {
    drawImage,
    fillRect,
    save,
    restore,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    fillStyle: '' as string | CanvasGradient | CanvasPattern,
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: BlobCallback) => {
      const next = blobs.shift();
      if (!next) {
        throw new Error('no blob queued');
      }
      queueMicrotask(() => cb(next));
    }),
  };
  const original = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: unknown) => {
    if (tag === 'canvas') {
      return canvas as unknown as HTMLCanvasElement;
    }
    return original(tag, options as ElementCreationOptions);
  });
  return { drawImage, fillRect, canvas, ctx };
}

describe('assertUploadableImage', () => {
  it('accepts jpeg/png/webp within the input size limit', () => {
    expect(assertUploadableImage(fileWithSize(10, 'a.jpg', 'image/jpeg'))).toBe('image/jpeg');
    expect(assertUploadableImage(fileWithSize(10, 'a.png', 'image/png'))).toBe('image/png');
  });

  it('rejects wrong types and empty / oversized inputs', () => {
    expect(() => assertUploadableImage(fileWithSize(10, 'a.gif', 'image/gif'))).toThrow(
      'UPLOAD_TYPE',
    );
    expect(() => assertUploadableImage(fileWithSize(0, 'a.jpg', 'image/jpeg'))).toThrow(
      'UPLOAD_INPUT_SIZE',
    );
    expect(() =>
      assertUploadableImage(fileWithSize(IMAGE_INPUT_MAX_BYTES + 1, 'huge.jpg', 'image/jpeg')),
    ).toThrow('UPLOAD_INPUT_SIZE');
  });

  it('allows originals larger than the 5 MB output cap', () => {
    expect(
      assertUploadableImage(fileWithSize(UPLOAD_MAX_BYTES + 1000, 'phone.jpg', 'image/jpeg')),
    ).toBe('image/jpeg');
  });
});

describe('downscaleImageFile', () => {
  it('scales the longest edge to ≤1600 and keeps aspect ratio', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => mockBitmap(3200, 1800)),
    );
    const { drawImage, canvas } = stubCanvas([
      new Blob([new Uint8Array(20)], { type: 'image/jpeg' }),
    ]);
    const prepared = await downscaleImageFile(fileWithSize(12, 'cover.jpg', 'image/jpeg'));

    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.fileName).toBe('upload.jpg');
    expect(prepared.blob.size).toBe(20);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1600, 900);
  });

  it('does not upscale small images', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => mockBitmap(400, 300)),
    );
    const { canvas } = stubCanvas([new Blob([new Uint8Array(8)], { type: 'image/png' })]);
    const prepared = await downscaleImageFile(fileWithSize(8, 'small.png', 'image/png'));
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(300);
    expect(prepared.contentType).toBe('image/png');
    expect(prepared.fileName).toBe('upload.png');
  });

  it('accepts a >5 MB input when the downscaled output fits', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => mockBitmap(2400, 2400)),
    );
    stubCanvas([new Blob([new Uint8Array(100)], { type: 'image/jpeg' })]);
    const prepared = await downscaleImageFile(
      fileWithSize(UPLOAD_MAX_BYTES + 50_000, 'phone.jpg', 'image/jpeg'),
    );
    expect(prepared.blob.size).toBeLessThanOrEqual(UPLOAD_MAX_BYTES);
  });

  it('re-encodes an oversized PNG output as JPEG', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => mockBitmap(800, 600)),
    );
    const oversizedPng = new Blob([new Uint8Array(16)], { type: 'image/png' });
    Object.defineProperty(oversizedPng, 'size', { value: UPLOAD_MAX_BYTES + 10 });
    const jpeg = new Blob([new Uint8Array(50)], { type: 'image/jpeg' });
    stubCanvas([oversizedPng, jpeg]);
    const prepared = await downscaleImageFile(fileWithSize(30, 'photo.png', 'image/png'));
    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.fileName).toBe('upload.jpg');
  });

  it('falls back from WebP to JPEG when the browser returns another type', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => mockBitmap(100, 100)),
    );
    const fakeWebpAsPng = new Blob([new Uint8Array(12)], { type: 'image/png' });
    const jpeg = new Blob([new Uint8Array(10)], { type: 'image/jpeg' });
    stubCanvas([fakeWebpAsPng, jpeg]);
    const prepared = await downscaleImageFile(fileWithSize(10, 'a.webp', 'image/webp'));
    expect(prepared.contentType).toBe('image/jpeg');
    expect(prepared.fileName).toBe('upload.jpg');
  });

  it('maps decode failures to UPLOAD_TYPE', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => {
        throw new Error('decode failed');
      }),
    );
    await expect(downscaleImageFile(fileWithSize(10, 'bad.jpg', 'image/jpeg'))).rejects.toThrow(
      'UPLOAD_TYPE',
    );
  });

  it('retries createImageBitmap without options on TypeError', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('unknown option'))
      .mockResolvedValueOnce(mockBitmap(100, 100));
    vi.stubGlobal('createImageBitmap', create);
    const { fillRect } = stubCanvas([new Blob([new Uint8Array(8)], { type: 'image/jpeg' })]);
    await downscaleImageFile(fileWithSize(10, 'a.jpg', 'image/jpeg'));
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[1]).toEqual({ imageOrientation: 'from-image' });
    expect(create.mock.calls[1]?.[1]).toBeUndefined();
    expect(fillRect).toHaveBeenCalled();
  });

  it('throws UPLOAD_SIZE when JPEG stays oversized after quality retry and closes the bitmap', async () => {
    const bitmap = mockBitmap(800, 600);
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(async () => bitmap),
    );
    const oversized = new Blob([new Uint8Array(16)], { type: 'image/jpeg' });
    Object.defineProperty(oversized, 'size', { value: UPLOAD_MAX_BYTES + 1 });
    stubCanvas([oversized, oversized]);
    await expect(downscaleImageFile(fileWithSize(20, 'huge.jpg', 'image/jpeg'))).rejects.toThrow(
      'UPLOAD_SIZE',
    );
    expect(bitmap.close).toHaveBeenCalled();
  });
});
