import { DEFAULT_LOCALE, type Locale } from './locales.js';

/**
 * Maps a BCP-47 primary language subtag to one of our supported locales, per ADR-0004's
 * resolution order:
 *
 * - `sr`, `cnr`, `bs`, `hr`, `sh` -> `me` (Montenegrin/Serbian family, Latin script in our UI).
 * - `ru`, `uk`, `be` -> `ru` (closest usable locale for other Slavic CIS languages).
 * - `tr` -> `tr`.
 * - `en` -> `en`.
 */
const PRIMARY_SUBTAG_TO_LOCALE: Readonly<Record<string, Locale>> = {
  sr: 'me',
  cnr: 'me',
  bs: 'me',
  hr: 'me',
  sh: 'me',
  ru: 'ru',
  uk: 'ru',
  be: 'ru',
  tr: 'tr',
  en: 'en',
};

/** A valid BCP-47 primary language subtag: 2-3 ASCII letters (after normalization). */
const PRIMARY_SUBTAG_PATTERN = /^[a-z]{2,3}$/;

/**
 * Extracts the primary language subtag from a language tag, e.g. `sr-Cyrl-RS` -> `sr`,
 * `en_GB` -> `en`. Returns `null` if the candidate does not start with a valid subtag.
 */
function primarySubtag(candidate: string): string | null {
  const normalized = candidate.trim().toLowerCase().replaceAll('_', '-');
  const [first] = normalized.split('-');
  if (!first || !PRIMARY_SUBTAG_PATTERN.test(first)) {
    return null;
  }
  return first;
}

/**
 * Resolves the best supported {@link Locale} from an ordered list of language preferences
 * (e.g. device languages, parsed `Accept-Language` values, or a single explicit user choice).
 *
 * The first candidate that maps to a supported locale wins; unrecognized or malformed candidates
 * are skipped. Falls back to {@link DEFAULT_LOCALE} if nothing matches (including an empty list).
 */
export function resolveLocale(candidates: readonly string[]): Locale {
  for (const candidate of candidates) {
    const subtag = primarySubtag(candidate);
    if (subtag === null) {
      continue;
    }
    const locale = PRIMARY_SUBTAG_TO_LOCALE[subtag];
    if (locale) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}
