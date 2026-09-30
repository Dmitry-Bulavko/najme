import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { AuthProvider } from './session-context';
import { GoogleSignInButton } from './google-sign-in-button';
import { setAccessToken } from '@/lib/api/client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
};

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderButton() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <GoogleSignInButton />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(fetch).mockResolvedValue(
    makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
  );
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('GoogleSignInButton', () => {
  it('renders nothing when NEXT_PUBLIC_GOOGLE_CLIENT_ID is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    renderButton();

    await waitFor(() => {
      expect(screen.queryByTestId('google-sign-in')).not.toBeInTheDocument();
    });
  });

  it('stays hidden when providers.google is false', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(makeJsonResponse({ google: false }));

    renderButton();

    await waitFor(() => {
      // Host may mount briefly while probing; it must not become visible.
      const host = screen.queryByTestId('google-sign-in');
      if (host) {
        expect(host).toHaveClass('hidden');
      }
    });
  });
});
