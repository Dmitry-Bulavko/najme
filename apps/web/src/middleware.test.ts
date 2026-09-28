import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { LOCALE_COOKIE_NAME } from './i18n/routing';
import { middleware } from './middleware';

describe('middleware', () => {
  it('keeps an explicit "me" cookie choice even when Accept-Language prefers English (#34)', () => {
    const request = new NextRequest('https://najme.example/settings', {
      headers: {
        cookie: `${LOCALE_COOKIE_NAME}=me`,
        'accept-language': 'en-US',
      },
    });

    const response = middleware(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/me/settings');
    expect(response.cookies.get(LOCALE_COOKIE_NAME)?.value).toBe('me');
  });
});
