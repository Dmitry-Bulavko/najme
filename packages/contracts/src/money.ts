import { z } from 'zod';

import type { ContractLocale } from './locale.js';

/**
 * ISO 4217 currency code: three uppercase letters. Not validated against the full ISO 4217 list,
 * only the format — the set of currencies Najme actually accepts is a business decision made by
 * the feature that first needs it.
 */
export const currencySchema = z.string().regex(/^[A-Z]{3}$/, 'must be a 3-letter ISO 4217 code');

/**
 * An amount of money as an integer in the currency's minor units (e.g. cents), per
 * `docs/conventions/api.md`. Zero and negative amounts are both valid: negative amounts represent
 * refunds, credits or other debits; individual endpoints (e.g. service pricing) may additionally
 * require a non-negative amount.
 */
export const moneySchema = z.object({
  amount: z.number().int(),
  currency: currencySchema,
});

export type Money = z.infer<typeof moneySchema>;

/** Fraction digits for EUR (and other 2-decimal ISO currencies) used by MoneyInput. */
export const MONEY_FRACTION_DIGITS = 2;

const MINOR_FACTOR = 10 ** MONEY_FRACTION_DIGITS;

/**
 * Returns false when grouping separators appear in invalid positions.
 * Valid: no grouping separator present, or `\d{1,3}(sep\d{3})+`.
 */
function hasValidGrouping(raw: string, groupingSep: ',' | '.'): boolean {
  if (!raw.includes(groupingSep)) return true;
  const esc = groupingSep === '.' ? '\\.' : ',';
  return new RegExp(`^\\d{1,3}(?:${esc}\\d{3})+$`).test(raw);
}

/**
 * Parse a user-typed major-unit string into integer minor units.
 *
 * Locale rules:
 * - `en`:               `.` = decimal,  `,` or space = grouping
 * - `me` / `ru` / `tr`: `,` = decimal, `.` or space = grouping
 *
 * Returns `null` when:
 * - the string is empty / whitespace;
 * - it contains characters other than digits, a leading `+`/`-`, `.`, `,`, or space;
 * - the locale's decimal separator appears more than once (ambiguous);
 * - the integer part exceeds `Number.MAX_SAFE_INTEGER`;
 * - the result exceeds `Number.MAX_SAFE_INTEGER`.
 *
 * `-0` is normalised to `0`. Uses decimal-digit arithmetic to avoid binary-float drift
 * (e.g. `1.005 * 100 === 100.499…` in IEEE 754).
 */
export function parseMajorToMinor(raw: string, locale: ContractLocale = 'en'): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Strict: only digits, an optional leading sign, `.`, `,`, and spaces (grouping).
  if (!/^[+-]?[\d.,\s]*$/.test(trimmed)) return null;
  // A bare sign with no digits is not a number.
  if (/^[+-]$/.test(trimmed)) return null;

  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');

  const decimalSep: '.' | ',' = locale === 'en' ? '.' : ',';
  const groupingSep: ',' | '.' = locale === 'en' ? ',' : '.';

  // Remove spaces — they are always treated as thousands grouping.
  const noSpaces = unsigned.replace(/\s+/g, '');

  const decimalCount = (noSpaces.match(new RegExp(`\\${decimalSep}`, 'g')) ?? []).length;

  if (decimalCount > 1) {
    // More than one decimal separator — ambiguous, refuse to guess.
    return null;
  }

  let intPart: string;
  let fracPart: string;

  if (decimalCount === 1) {
    const idx = noSpaces.indexOf(decimalSep);
    const rawInt = noSpaces.slice(0, idx);
    // Grouping separators in the integer portion must follow N,NNN,NNN pattern.
    if (!hasValidGrouping(rawInt, groupingSep)) return null;
    intPart = rawInt.replace(new RegExp(`\\${groupingSep}`, 'g'), '');
    fracPart = noSpaces.slice(idx + 1);
    // Grouping separator must not appear in the fraction.
    if (fracPart.includes(groupingSep)) return null;
    if (fracPart !== '' && !/^\d+$/.test(fracPart)) return null;
  } else {
    // No decimal separator — all grouping separators are thousands markers.
    if (!hasValidGrouping(noSpaces, groupingSep)) return null;
    intPart = noSpaces.replace(new RegExp(`\\${groupingSep}`, 'g'), '');
    fracPart = '';
  }

  if (intPart === '' && fracPart === '') return null;
  // Allow ".5" (empty intPart with a fraction), but intPart must be pure digits if present.
  if (intPart !== '' && !/^\d+$/.test(intPart)) return null;

  const whole = intPart === '' ? 0 : Number(intPart);
  if (whole > Number.MAX_SAFE_INTEGER) return null;

  // Decimal-digit arithmetic: avoid `1.005 * 100 === 100.499…` in IEEE 754.
  const padded = fracPart.padEnd(MONEY_FRACTION_DIGITS + 1, '0');
  const kept = padded.slice(0, MONEY_FRACTION_DIGITS);
  const nextDigit = padded.charAt(MONEY_FRACTION_DIGITS);
  let minor = whole * MINOR_FACTOR + Number(kept);
  if (nextDigit !== '' && Number(nextDigit) >= 5) minor += 1;

  if (minor > Number.MAX_SAFE_INTEGER) return null;

  // Normalise -0 → 0.
  const result = negative ? -minor : minor;
  return result === 0 ? 0 : result;
}

/**
 * Format integer minor units as a major-unit string using the locale's decimal separator.
 * Uses `.` for `en` and `,` for `me` / `ru` / `tr`.
 */
export function formatMinorAsMajor(minor: number, locale: ContractLocale = 'en'): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const major = Math.floor(abs / MINOR_FACTOR);
  const fraction = String(abs % MINOR_FACTOR).padStart(MONEY_FRACTION_DIGITS, '0');
  const decimalSep = locale === 'en' ? '.' : ',';
  return `${negative ? '-' : ''}${major}${decimalSep}${fraction}`;
}
