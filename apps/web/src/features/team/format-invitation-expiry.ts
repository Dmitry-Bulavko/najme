import { isLocale, toIntlLocale, type Locale } from '@najme/i18n';

/** Format an invitation expiry instant in the business timezone and UI locale. */
export function formatInvitationExpiry(iso: string, locale: string, timeZone: string): string {
  const safeLocale: Locale = isLocale(locale) ? locale : 'en';
  return new Intl.DateTimeFormat(toIntlLocale(safeLocale), {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}
