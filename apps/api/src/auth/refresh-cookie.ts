import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'najme_rt';
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const COOKIE_PATH = '/api/v1/auth';

function cookieOptions(secure: boolean): CookieOptions {
  return { httpOnly: true, sameSite: 'lax', secure, path: COOKIE_PATH };
}

export function setRefreshCookie(res: Response, token: string, secure: boolean): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...cookieOptions(secure),
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, cookieOptions(secure));
}

/** Reads the refresh cookie from the raw header (no cookie-parser dependency needed). */
export function readRefreshCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const separator = part.indexOf('=');
    if (separator > 0 && part.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      const value = part.slice(separator + 1).trim();
      try {
        return decodeURIComponent(value) || undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Mobile clients opt into token-in-body delivery with `X-Client: mobile` (ADR-0010). */
export function isMobileClient(req: Request): boolean {
  return req.header('x-client')?.trim().toLowerCase() === 'mobile';
}
