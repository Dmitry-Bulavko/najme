import { describe, expect, it } from 'vitest';
import {
  ensureValidBusinessSlug,
  isValidBusinessSlug,
  nextSlugCandidate,
  slugifyBusinessName,
} from './slug.js';

describe('business slug helpers', () => {
  it('transliterates South-Slavic, Turkish and Cyrillic characters', () => {
    expect(slugifyBusinessName('Čarolija')).toBe('carolija');
    expect(slugifyBusinessName('Şiş Koç')).toBe('sis-koc');
    expect(slugifyBusinessName('Салон Красоты')).toBe('salon-krasoty');
  });

  it('ensures short, empty and reserved names become valid', () => {
    expect(isValidBusinessSlug(ensureValidBusinessSlug(''))).toBe(true);
    expect(isValidBusinessSlug(ensureValidBusinessSlug('ab'))).toBe(true);
    expect(isValidBusinessSlug(ensureValidBusinessSlug('admin'))).toBe(true);
    expect(ensureValidBusinessSlug('admin')).not.toBe('admin');
  });

  it('allocates numeric collision suffixes within 60 characters', () => {
    expect(nextSlugCandidate('salon', 0)).toBe('salon');
    expect(nextSlugCandidate('salon', 1)).toBe('salon-2');
    expect(nextSlugCandidate('a'.repeat(60), 1).length).toBeLessThanOrEqual(60);
  });
});
