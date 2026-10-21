import { describe, expect, it } from 'vitest';
import { buildObjectKey, isValidUploadKey, keyPrefixFor, publicObjectUrl } from './object-keys.js';

describe('object-keys', () => {
  it('builds keys under businesses/<id>/<kind>/', () => {
    const key = buildObjectKey('11111111-1111-4111-8111-111111111111', 'LOGO', 'image/jpeg');
    expect(key).toMatch(
      /^businesses\/11111111-1111-4111-8111-111111111111\/logo\/[0-9a-f-]+\.jpg$/,
    );
    expect(isValidUploadKey(key, '11111111-1111-4111-8111-111111111111', 'LOGO')).toBe(true);
  });

  it('joins public URLs without duplicate slashes', () => {
    expect(publicObjectUrl('http://localhost:9000/najme/', '/businesses/a/logo/x.jpg')).toBe(
      'http://localhost:9000/najme/businesses/a/logo/x.jpg',
    );
  });

  it('rejects keys outside the strict shape', () => {
    const businessId = '11111111-1111-4111-8111-111111111111';
    const prefix = keyPrefixFor(businessId, 'COVER');
    expect(
      isValidUploadKey(`${prefix}aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`, businessId, 'COVER'),
    ).toBe(true);
    expect(
      isValidUploadKey(
        `${prefix}../logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`,
        businessId,
        'COVER',
      ),
    ).toBe(false);
    expect(isValidUploadKey(`${prefix}not-a-uuid.webp`, businessId, 'COVER')).toBe(false);
    expect(
      isValidUploadKey(
        `businesses/other/cover/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.webp`,
        businessId,
        'COVER',
      ),
    ).toBe(false);
  });
});
