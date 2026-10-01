import { describe, expect, it } from 'vitest';

import { transliterateAscii } from './transliterate.js';

describe('transliterateAscii', () => {
  it('transliterates Russian Cyrillic with hyphen separators', () => {
    expect(transliterateAscii('Салон Красоты', '-')).toBe('salon-krasoty');
    expect(transliterateAscii('Аллергии', '_')).toBe('allergii');
  });

  it('transliterates South-Slavic Latin and Turkish', () => {
    expect(transliterateAscii('Đorđe', '-')).toBe('djordje');
    expect(transliterateAscii('Iğdır', '_')).toBe('igdir');
  });

  it('returns empty for whitespace-only input', () => {
    expect(transliterateAscii('   ', '_')).toBe('');
  });
});
