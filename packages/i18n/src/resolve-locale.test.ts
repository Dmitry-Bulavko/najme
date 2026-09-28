import { describe, expect, it } from 'vitest';

import { resolveLocale } from './resolve-locale.js';

describe('resolveLocale', () => {
  const cases: Array<[string, readonly string[], string]> = [
    ['empty list falls back to en', [], 'en'],
    ['exact en', ['en'], 'en'],
    ['en with region', ['en-US'], 'en'],
    ['en with underscore separator', ['en_GB'], 'en'],
    ['sr maps to me', ['sr'], 'me'],
    ['sr with region maps to me', ['sr-RS'], 'me'],
    ['sr with script subtag maps to me', ['sr-Cyrl-RS'], 'me'],
    ['sr with underscore separators maps to me', ['sr_Latn_ME'], 'me'],
    ['cnr maps to me', ['cnr'], 'me'],
    ['bs maps to me', ['bs-BA'], 'me'],
    ['hr maps to me', ['hr-HR'], 'me'],
    ['sh maps to me', ['sh'], 'me'],
    ['ru maps to ru', ['ru-RU'], 'ru'],
    ['uk maps to ru', ['uk'], 'ru'],
    ['be maps to ru', ['be-BY'], 'ru'],
    ['tr maps to tr', ['tr-TR'], 'tr'],
    ['is case-insensitive', ['SR-RS'], 'me'],
    ['first match wins over later matches', ['fr', 'de', 'tr', 'ru'], 'tr'],
    ['skips unrecognized candidates before a match', ['fr-FR', 'de-DE', 'ru-RU'], 'ru'],
    ['falls back to en when nothing matches', ['fr-FR', 'de-DE', 'ja-JP'], 'en'],
    ['ignores an empty string candidate', ['', 'tr'], 'tr'],
    ['ignores a bare wildcard candidate', ['*', 'ru'], 'ru'],
    ['ignores garbage candidates like x-klingon', ['x-klingon', 'en'], 'en'],
    ['ignores whitespace-only candidates', ['   ', 'sr'], 'me'],
    ['trims surrounding whitespace', [' tr '], 'tr'],
  ];

  it.each(cases)('%s', (_description, candidates, expected) => {
    expect(resolveLocale(candidates)).toBe(expected);
  });
});
