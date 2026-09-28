'use client';

import { isLocale, LOCALE_META, SUPPORTED_LOCALES } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type { ChangeEvent, ReactElement } from 'react';

import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';

/**
 * Lets the user pick a locale, preserving the current path and remembering the choice in a cookie
 * (ADR-0004 step 1 — explicit user choice) so the next visit skips `Accept-Language` negotiation.
 * Labels are the native names from `LOCALE_META`, not translated.
 */
export function LanguageSwitcher(): ReactElement {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('languageSwitcher');

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    if (!isLocale(next) || next === locale) {
      return;
    }

    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;

    const segments = pathname.split('/');
    segments[1] = next;
    router.replace(segments.join('/') || `/${next}`);
  }

  return (
    <label>
      <span className="sr-only">{t('label')}</span>
      <select value={locale} onChange={handleChange} aria-label={t('label')}>
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].label}
          </option>
        ))}
      </select>
    </label>
  );
}
