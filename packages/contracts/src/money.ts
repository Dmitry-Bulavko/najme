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
