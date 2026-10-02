import { describe, expect, it } from '@jest/globals';

import {
  isValidCustomFieldKey,
  slugCustomFieldKey,
  uniqueCustomFieldKey,
} from '@/features/services/slug-custom-field-key';

describe('slugCustomFieldKey', () => {
  it('slugs Latin labels into valid keys', () => {
    expect(slugCustomFieldKey('Pickup address')).toBe('pickup_address');
    expect(isValidCustomFieldKey(slugCustomFieldKey('Pickup address'))).toBe(true);
  });

  it('prefixes when the slug would start with a digit', () => {
    expect(slugCustomFieldKey('2nd preference')).toBe('f_2nd_preference');
  });

  it('returns empty for empty or symbol-only labels', () => {
    expect(slugCustomFieldKey('')).toBe('');
    expect(slugCustomFieldKey('!!!')).toBe('');
  });
});

describe('uniqueCustomFieldKey', () => {
  it('appends a numeric suffix on collision', () => {
    expect(uniqueCustomFieldKey('notes', ['notes'])).toBe('notes_2');
    expect(uniqueCustomFieldKey('notes', ['notes', 'notes_2'])).toBe('notes_3');
  });
});
