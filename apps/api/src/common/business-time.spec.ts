import { afterEach, describe, expect, it } from 'vitest';
import { localToUtc, utcToLocal } from './business-time.js';

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

describe.each(['UTC', 'America/New_York', 'Europe/Podgorica', 'Asia/Tokyo'] as const)(
  'BusinessTime Europe/Podgorica (process TZ=%s)',
  (processTz) => {
    it('fall-back 2026-10-25: ambiguous 02:30 takes the earlier offset → 00:30Z', () => {
      process.env.TZ = processTz;
      const utc = localToUtc('2026-10-25T02:30');
      expect(utc.toISOString()).toBe('2026-10-25T00:30:00.000Z');
      expect(utcToLocal(utc)).toBe('2026-10-25T02:30');
      // The later occurrence of 02:30 is 01:30Z and also formats as 02:30.
      expect(utcToLocal(new Date('2026-10-25T01:30:00.000Z'))).toBe('2026-10-25T02:30');
    });

    it('spring-forward 2026-03-29: nonexistent 02:30 resolves forward → 01:30Z', () => {
      process.env.TZ = processTz;
      const utc = localToUtc('2026-03-29T02:30');
      expect(utc.toISOString()).toBe('2026-03-29T01:30:00.000Z');
      expect(utcToLocal(utc)).toBe('2026-03-29T03:30');
    });

    it('round-trips a normal winter local time', () => {
      process.env.TZ = processTz;
      const utc = localToUtc('2026-01-15T09:00');
      expect(utc.toISOString()).toBe('2026-01-15T08:00:00.000Z');
      expect(utcToLocal(utc)).toBe('2026-01-15T09:00');
    });
  },
);
