import { describe, expect, it } from 'vitest';
import { buildObjectKey, isKeyUnderPrefix, keyPrefixFor, publicObjectUrl } from './object-keys.js';

describe('object-keys', () => {
  it('builds keys under businesses/<id>/<kind>/', () => {
    const key = buildObjectKey('11111111-1111-4111-8111-111111111111', 'LOGO', 'image/jpeg');
    expect(key).toMatch(
      /^businesses\/11111111-1111-4111-8111-111111111111\/logo\/[0-9a-f-]+\.jpg$/,
    );
  });

  it('joins public URLs without duplicate slashes', () => {
    expect(publicObjectUrl('http://localhost:9000/najme/', '/businesses/a/logo/x.jpg')).toBe(
      'http://localhost:9000/najme/businesses/a/logo/x.jpg',
    );
  });

  it('validates key prefixes', () => {
    const prefix = keyPrefixFor('11111111-1111-4111-8111-111111111111', 'COVER');
    expect(isKeyUnderPrefix(`${prefix}abc.webp`, prefix)).toBe(true);
    expect(isKeyUnderPrefix('businesses/other/cover/x.webp', prefix)).toBe(false);
  });
});
