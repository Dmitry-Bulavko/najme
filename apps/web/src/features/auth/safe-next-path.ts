import { isLocale, type Locale } from '@najme/i18n';

/** Scheme at the start of a value (e.g. `javascript:`, `https:`). */
const LEADING_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

/** True when `value` contains ASCII C0 controls or DEL. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Validates `?next=` so auth redirects stay on this app's locale-prefixed paths.
 * Rejects open redirects (`https://…`, `//…`, `/\…`, encoded `//`, schemes, unknown locales).
 * Returns `next` unchanged when safe; otherwise `/${locale}`.
 */
export function safeNextPath(next: string | null, locale: Locale): string {
  const fallback = `/${locale}`;
  if (next == null || next === '') {
    return fallback;
  }

  let decoded: string;
  try {
    // Catch encoded protocol-relative paths such as `/%2F%2Fevil.com`.
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }

  if (!isSafeRelativePath(next) || !isSafeRelativePath(decoded)) {
    return fallback;
  }

  if (typeof window === 'undefined') {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(next, window.location.origin);
  } catch {
    return fallback;
  }

  if (url.origin !== window.location.origin) {
    return fallback;
  }

  const firstSegment = url.pathname.split('/')[1] ?? '';
  if (!isLocale(firstSegment)) {
    return fallback;
  }

  return next;
}

/**
 * Rewrites the first path segment (locale) of an already-validated same-origin path,
 * preserving query string and hash.
 */
export function replaceLocaleInPath(path: string, locale: Locale): string {
  const hashIndex = path.indexOf('#');
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : '';
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;

  const queryIndex = withoutHash.indexOf('?');
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  const pathname = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;

  const segments = pathname.split('/');
  // pathname `/en/account` → ['', 'en', 'account']; index 1 is the locale.
  segments[1] = locale;
  const newPathname = segments.join('/') || `/${locale}`;
  return `${newPathname}${query}${hash}`;
}

function isSafeRelativePath(value: string): boolean {
  if (LEADING_SCHEME.test(value) || value.includes('://')) {
    return false;
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return false;
  }
  if (value.includes('\\') || hasControlChars(value)) {
    return false;
  }
  return true;
}
