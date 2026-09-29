import { z } from 'zod';

/**
 * UI locale codes. Duplicated from `SUPPORTED_LOCALES` in `@najme/i18n` because contracts must not
 * depend on i18n at runtime; `locale.test.ts` asserts the two stay identical.
 */
export const localeSchema = z.enum(['en', 'me', 'ru', 'tr']);

export type ContractLocale = z.infer<typeof localeSchema>;
