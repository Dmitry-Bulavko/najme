import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertUploadableImage } from './downscale-image';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('assertUploadableImage', () => {
  it('accepts jpeg/png/webp within the size limit', () => {
    expect(
      assertUploadableImage(new File([new Uint8Array(10)], 'a.jpg', { type: 'image/jpeg' })),
    ).toBe('image/jpeg');
    expect(
      assertUploadableImage(new File([new Uint8Array(10)], 'a.png', { type: 'image/png' })),
    ).toBe('image/png');
  });

  it('rejects wrong types and empty files', () => {
    expect(() =>
      assertUploadableImage(new File([new Uint8Array(10)], 'a.gif', { type: 'image/gif' })),
    ).toThrow('UPLOAD_TYPE');
    expect(() => assertUploadableImage(new File([], 'a.jpg', { type: 'image/jpeg' }))).toThrow(
      'UPLOAD_SIZE',
    );
  });
});
