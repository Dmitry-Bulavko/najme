'use client';

import { isLocale, LOCALE_META, SUPPORTED_LOCALES } from '@najme/i18n';
import { ChevronDown, Globe } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';

/**
 * Lets the user pick a locale from a dropdown, preserving the current path and remembering the
 * choice in a cookie (ADR-0004 step 1 — explicit user choice) so the next visit skips
 * `Accept-Language` negotiation. Labels are the native names from `LOCALE_META`, not translated.
 */
export function LanguageSwitcher(): ReactElement {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('languageSwitcher');

  function handleChange(next: string): void {
    if (!isLocale(next) || next === locale) {
      return;
    }

    document.cookie = `${LOCALE_COOKIE_NAME}=${next}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;

    const segments = pathname.split('/');
    segments[1] = next;
    router.replace(segments.join('/') || `/${next}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('label')}>
          <Globe aria-hidden="true" />
          <span className="uppercase">{locale}</span>
          <ChevronDown className="opacity-60" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
          {SUPPORTED_LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {LOCALE_META[code].label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
