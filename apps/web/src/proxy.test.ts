import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { LOCALE_COOKIE_NAME } from './i18n/routing';
import { proxy } from './proxy';

describe('proxy', () => {
  it('keeps an explicit "me" cookie choice even when Accept-Language prefers English (#34)', () => {
    const request = new NextRequest('https://najme.example/settings', {
      headers: {
        cookie: `${LOCALE_COOKIE_NAME}=me`,
        'accept-language': 'en-US',
      },
    });

    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/me/settings');
    expect(response.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe('me');
  });

  const redirectPath = (path: string, headers: Record<string, string> = {}): string => {
    const response = proxy(new NextRequest(`https://najme.example${path}`, { headers }));
    expect(response.status).toBe(307);
    return new URL(response.headers.get('location') ?? '').pathname;
  };

  it('passes through paths with a supported locale segment', () => {
    const response = proxy(new NextRequest('https://najme.example/ru/foo'));
    expect(response.headers.get('location')).toBeNull();
  });

  it('replaces an unsupported locale segment instead of prefixing it', () => {
    expect(redirectPath('/xx/foo')).toBe('/en/foo');
    expect(redirectPath('/xx-YY/foo/bar', { 'accept-language': 'tr' })).toBe('/tr/foo/bar');
    expect(redirectPath('/xx')).toBe('/en');
  });

  it('keeps the query string and sets the cookie when stripping a segment', () => {
    const response = proxy(new NextRequest('https://najme.example/xx/foo?a=1'));
    expect(new URL(response.headers.get('location') ?? '').search).toBe('?a=1');
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/en/foo');
    expect(response.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe('en');
  });

  it('strips region-qualified segments but never bare 3-letter ones', () => {
    expect(redirectPath('/xx-YY/x')).toBe('/en/x');
    expect(redirectPath('/faq/x')).toBe('/en/faq/x');
    expect(redirectPath('/map')).toBe('/en/map');
  });

  it('prefixes paths with a missing locale segment', () => {
    expect(redirectPath('/')).toBe('/en');
    expect(redirectPath('/about')).toBe('/en/about');
    expect(redirectPath('/business/x', { 'accept-language': 'ru' })).toBe('/ru/business/x');
  });
});
