/**
 * Business slug generation (#73 / ADR-0013).
 * Transliterates Latin/Cyrillic/Turkish characters, then kebab-cases.
 */

export const RESERVED_BUSINESS_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'business',
  'categories',
  'cities',
  'health',
  'me',
  'new',
  'public',
]);

const CHAR_MAP: Record<string, string> = {
  č: 'c',
  ć: 'c',
  š: 's',
  ž: 'z',
  đ: 'd',
  Č: 'c',
  Ć: 'c',
  Š: 's',
  Ž: 'z',
  Đ: 'd',
  ą: 'a',
  ę: 'e',
  ł: 'l',
  ń: 'n',
  ó: 'o',
  ś: 's',
  ź: 'z',
  ż: 'z',
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
};

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Transliterate and kebab-case a display name into a candidate slug (may be empty). */
export function slugifyBusinessName(name: string): string {
  let out = '';
  for (const ch of name.normalize('NFKD')) {
    if (CHAR_MAP[ch] !== undefined) {
      out += CHAR_MAP[ch];
      continue;
    }
    if (/[A-Za-z0-9]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/\s|_/.test(ch) || ch === '-' || ch === '/') {
      out += '-';
    }
    // drop combining marks and other punctuation
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60).replace(/-$/, '');
}

/**
 * Ensures a slug matches the public pattern, length, and reserved-word rules.
 * Empty / short / reserved inputs become `biz` / `x-biz` / `reserved-biz` style bases.
 */
export function ensureValidBusinessSlug(raw: string): string {
  let base = raw;
  if (!base || !SLUG_RE.test(base) || base.length < 3 || RESERVED_BUSINESS_SLUGS.has(base)) {
    const seed = base && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(base) ? base : 'biz';
    base =
      RESERVED_BUSINESS_SLUGS.has(seed) || seed.length < 3 ? `${seed}-biz`.replace(/^-/, '') : seed;
    if (base.length < 3) {
      base = 'biz';
    }
    if (RESERVED_BUSINESS_SLUGS.has(base)) {
      base = `${base}-biz`;
    }
  }
  return base.slice(0, 60).replace(/-$/, '');
}

/** Next collision candidate: `base`, then `base-2`, `base-3`, … (truncated to 60). */
export function nextSlugCandidate(base: string, attempt: number): string {
  if (attempt === 0) {
    return base.slice(0, 60);
  }
  const suffix = `-${attempt + 1}`;
  const head = base.slice(0, Math.max(1, 60 - suffix.length)).replace(/-$/, '');
  return `${head}${suffix}`;
}

export function isValidBusinessSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 60 &&
    SLUG_RE.test(slug) &&
    !RESERVED_BUSINESS_SLUGS.has(slug)
  );
}
