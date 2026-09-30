import { z } from 'zod';

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
 * Parse a user-typed major-unit string into integer minor units. Accepts both `,` and `.` as the
 * decimal separator; rounds half-away-from-zero to {@link MONEY_FRACTION_DIGITS} using decimal
 * digit arithmetic (avoids binary float drift like `1.005 * 100`). Returns `null` when the string
 * is empty or not a number.
 */
export function parseMajorToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  // Last `,` or `.` is the decimal separator; earlier ones are thousands separators.
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  let integerDigits: string;
  let fractionDigits: string;
  if (decimalIndex === -1) {
    integerDigits = trimmed.replace(/[^\d+-]/g, '');
    fractionDigits = '';
  } else {
    integerDigits = trimmed.slice(0, decimalIndex).replace(/[^\d+-]/g, '');
    fractionDigits = trimmed.slice(decimalIndex + 1).replace(/\D/g, '');
  }

  const negative = integerDigits.startsWith('-');
  const unsignedInteger = integerDigits.replace(/^[+-]/, '');

  // Need at least one digit somewhere (".5" / "-,5" → unsigned empty + fraction ok).
  if (unsignedInteger === '' && fractionDigits === '') {
    return null;
  }
  if (unsignedInteger !== '' && !/^\d+$/.test(unsignedInteger)) {
    return null;
  }
  if (fractionDigits !== '' && !/^\d+$/.test(fractionDigits)) {
    return null;
  }

  const whole = unsignedInteger === '' ? 0 : Number(unsignedInteger);
  const padded = fractionDigits.padEnd(MONEY_FRACTION_DIGITS + 1, '0');
  const kept = padded.slice(0, MONEY_FRACTION_DIGITS);
  const nextDigit = padded.charAt(MONEY_FRACTION_DIGITS);
  let minor = whole * MINOR_FACTOR + Number(kept);
  if (nextDigit !== '' && Number(nextDigit) >= 5) {
    minor += 1;
  }

  return negative ? -minor : minor;
}

/** Format integer minor units as a major-unit string with a `.` decimal separator. */
export function formatMinorAsMajor(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const major = Math.floor(abs / MINOR_FACTOR);
  const fraction = String(abs % MINOR_FACTOR).padStart(MONEY_FRACTION_DIGITS, '0');
  return `${negative ? '-' : ''}${major}.${fraction}`;
}
