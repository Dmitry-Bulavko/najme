/**
 * Shared Latin/Cyrillic/Turkish transliteration for business slugs and custom-field keys.
 * Keep in sync with consumers in apps/api and apps/web.
 */
export const TRANSLITERATION_CHAR_MAP: Readonly<Record<string, string>> = {
  // South-Slavic Latin
  č: 'c',
  ć: 'c',
  š: 's',
  ž: 'z',
  đ: 'dj',
  Č: 'c',
  Ć: 'c',
  Š: 's',
  Ž: 'z',
  Đ: 'dj',
  // Polish
  ą: 'a',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
  // Turkish
  ğ: 'g',
  ı: 'i',
  İ: 'i',
  ş: 's',
  ü: 'u',
  ö: 'o',
  ç: 'c',
  Ğ: 'g',
  Ş: 's',
  Ü: 'u',
  Ö: 'o',
  Ç: 'c',
  // Russian / shared Cyrillic
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  А: 'a',
  Б: 'b',
  В: 'v',
  Г: 'g',
  Д: 'd',
  Е: 'e',
  Ё: 'e',
  Ж: 'zh',
  З: 'z',
  И: 'i',
  Й: 'y',
  К: 'k',
  Л: 'l',
  М: 'm',
  Н: 'n',
  О: 'o',
  П: 'p',
  Р: 'r',
  С: 's',
  Т: 't',
  У: 'u',
  Ф: 'f',
  Х: 'h',
  Ц: 'ts',
  Ч: 'ch',
  Ш: 'sh',
  Щ: 'sch',
  Ъ: '',
  Ы: 'y',
  Ь: '',
  Э: 'e',
  Ю: 'yu',
  Я: 'ya',
  // Serbian / Montenegrin Cyrillic (map before NFKD so they are not dropped)
  ђ: 'dj',
  ј: 'j',
  љ: 'lj',
  њ: 'nj',
  ћ: 'c',
  џ: 'dz',
  Ђ: 'dj',
  Ј: 'j',
  Љ: 'lj',
  Њ: 'nj',
  Ћ: 'c',
  Џ: 'dz',
};

/**
 * Transliterate a display string to ASCII, joining word breaks with `separator`.
 * May be empty when nothing usable remains.
 */
export function transliterateAscii(input: string, separator: string): string {
  let out = '';
  // NFC first so mapped Cyrillic (й, ђ, …) hit the map before diacritic decomposition.
  for (const ch of input.normalize('NFC')) {
    if (TRANSLITERATION_CHAR_MAP[ch] !== undefined) {
      out += TRANSLITERATION_CHAR_MAP[ch];
      continue;
    }
    const stripped = ch.normalize('NFKD').replace(/\p{M}/gu, '');
    if (/[A-Za-z0-9]/.test(stripped)) {
      out += stripped.toLowerCase();
      continue;
    }
    if (/\s|_/.test(ch) || ch === '-' || ch === '/') {
      out += separator;
    }
  }
  const sepRe = new RegExp(`${escapeRegExp(separator)}+`, 'g');
  const trimRe = new RegExp(`^${escapeRegExp(separator)}|${escapeRegExp(separator)}$`, 'g');
  return out.replace(sepRe, separator).replace(trimRe, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
