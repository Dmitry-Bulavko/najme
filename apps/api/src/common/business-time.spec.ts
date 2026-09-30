import { describe, expect, it } from 'vitest';
import { localToUtc, utcToLocal } from './business-time.js';

describe('BusinessTime Europe/Podgorica', () => {
  it('spring-forward 2026-03-29: nonexistent 02:30 resolves forward', () => {
    // Clocks jump 02:00 → 03:00; 02:30 does not exist.
    const utc = localToUtc('2026-03-29T02:30');
    const local = utcToLocal(utc);
    // Forward into the 03:xx hour (or later).
    expect(local >= '2026-03-29T03:00').toBe(true);
    expect(local.startsWith('2026-03-29')).toBe(true);
  });

  it('fall-back 2026-10-25: ambiguous time takes the earlier offset', () => {
    // Clocks repeat 02:00–03:00; earlier offset is UTC+2 (CEST) → 00:30 UTC for 02:30.
    const utc = localToUtc('2026-10-25T02:30');
    expect(utc.toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });

  it('round-trips a normal winter local time', () => {
    const utc = localToUtc('2026-01-15T09:00');
    expect(utcToLocal(utc)).toBe('2026-01-15T09:00');
  });
});
