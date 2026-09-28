import { parseAcceptLanguage, resolveLocale } from '@najme/i18n';
import { type NextRequest, NextResponse } from 'next/server';

import { isSupportedLocale, LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from './i18n/routing';

export const config = {
  // Skip Next.js internals, static files and the API dev-proxy path.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};

/**
 * A first segment that looks like an attempted locale: two or three ASCII letters, optionally
 * followed by a region (`xx`, `xxx`, `xx-YY`). Only such segments are stripped when redirecting, so
 * real top-level paths (`/about`, `/business`) are kept intact.
 */
const LOCALE_LIKE_SEGMENT = /^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$/;

/**
 * Redirects any path without a supported locale prefix to `/{locale}/...`, resolving the locale
 * per ADR-0004: explicit cookie choice first, then `Accept-Language`, then `en`. Requests that
 * already carry a supported locale segment pass through unchanged. An unsupported locale-like
 * first segment (`/xx/foo`) is replaced rather than prefixed (`/en/foo`, not `/en/xx/foo`).
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const firstSegment = pathname.split('/')[1] ?? '';

  if (isSupportedLocale(firstSegment)) {
    return NextResponse.next();
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const acceptLanguage = parseAcceptLanguage(request.headers.get('accept-language') ?? '');
  const candidates = [...(cookieLocale ? [cookieLocale] : []), ...acceptLanguage];
  const locale = resolveLocale(candidates);

  const url = request.nextUrl.clone();
  const rest = LOCALE_LIKE_SEGMENT.test(firstSegment)
    ? pathname.slice(firstSegment.length + 1)
    : pathname;
  url.pathname = `/${locale}${rest === '/' ? '' : rest}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    path: '/',
  });
  return response;
}
