import { describe, expect, it } from 'vitest';
import {
  ensureValidBusinessSlug,
  isValidBusinessSlug,
  nextSlugCandidate,
  slugifyBusinessName,
} from './slug.js';

describe('business slug helpers', () => {
  it('transliterates Latin diacritics (South-Slavic / Polish)', () => {
    expect(slugifyBusinessName('Čarolija')).toBe('carolija');
    expect(slugifyBusinessName('Đorđe')).toBe('djordje');
  });

  it('transliterates Serbian / Montenegrin Cyrillic', () => {
    expect(slugifyBusinessName('Ђорђе')).toBe('djordje');
    expect(slugifyBusinessName('Јелена')).toBe('jelena');
    expect(slugifyBusinessName('Његош')).toBe('njegosh');
    expect(slugifyBusinessName('Љубав')).toBe('ljubav');
    expect(slugifyBusinessName('Ћосић')).toBe('cosic');
    expect(slugifyBusinessName('Џем')).toBe('dzem');
  });

  it('transliterates Russian Cyrillic', () => {
    expect(slugifyBusinessName('Салон Красоты')).toBe('salon-krasoty');
    expect(slugifyBusinessName('Йога')).toBe('yoga');
  });

  it('transliterates Turkish characters', () => {
    expect(slugifyBusinessName('Şiş Koç')).toBe('sis-koc');
    expect(slugifyBusinessName('Iğdır')).toBe('igdir');
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
