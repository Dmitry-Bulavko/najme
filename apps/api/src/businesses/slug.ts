/**
 * Business slug generation (#73 / ADR-0013).
 * Transliterates Latin/Cyrillic/Turkish characters, then kebab-cases.
 */
import { RESERVED_BUSINESS_SLUGS, transliterateAscii } from '@najme/contracts';

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Transliterate and kebab-case a display name into a candidate slug (may be empty). */
export function slugifyBusinessName(name: string): string {
  return transliterateAscii(name, '-').slice(0, 60).replace(/-$/, '');
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
