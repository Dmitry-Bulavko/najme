import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { AuthProvider } from './session-context';
import { GoogleSignInButton } from './google-sign-in-button';
import { setAccessToken } from '@/lib/api/client';

const replace = vi.fn();
const getParam = vi.fn<() => string | null>(() => null);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => ({ get: getParam }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

const fakeUser = {
  id: 'u1',
  email: 'alice@example.com',
  emailVerified: true,
  displayName: 'Alice',
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: false,
};

type GisCallback = (response: { credential: string }) => void;

function installGisMock() {
  let capturedCallback: GisCallback | null = null;
  const initialize = vi.fn((config: { callback: GisCallback }) => {
    capturedCallback = config.callback;
  });
  const renderButton = vi.fn();

  Object.defineProperty(window, 'google', {
    configurable: true,
    writable: true,
    value: {
      accounts: {
        id: { initialize, renderButton },
      },
    },
  });

  return {
    initialize,
    renderButton,
    getCallback: () => capturedCallback,
  };
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
  replace.mockClear();
  getParam.mockReturnValue(null);
  vi.stubGlobal('fetch', vi.fn());
  vi.mocked(fetch).mockResolvedValue(
    makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
  );
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'google');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'google');
});

describe('GoogleSignInButton', () => {
  it('renders nothing when NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID', '');
    renderButton();

    await waitFor(() => {
      expect(screen.queryByTestId('google-sign-in')).not.toBeInTheDocument();
    });
  });

  it('stays hidden when providers.google is false', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web-client.apps.googleusercontent.com');
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

  it('posts the GIS credential and redirects on success', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    // loadGisScript short-circuits when window.google.accounts.id already exists.
    const gis = installGisMock();

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
        );
      }
      if (url.includes('/auth/providers')) {
        return Promise.resolve(makeJsonResponse({ google: true }));
      }
      if (url.includes('/auth/google')) {
        return Promise.resolve(
          makeJsonResponse({
            accessToken: 'tok',
            accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
            user: fakeUser,
          }),
        );
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      );
    });

    renderButton();

    await waitFor(() => {
      expect(gis.initialize).toHaveBeenCalled();
    });

    const callback = gis.getCallback();
    expect(callback).not.toBeNull();
    callback!({ credential: 'gis-id-token' });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/google',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to /en when ?next= is an external URL', async () => {
    getParam.mockReturnValue('https://evil.example/pwned');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    const gis = installGisMock();

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
        );
      }
      if (url.includes('/auth/providers')) {
        return Promise.resolve(makeJsonResponse({ google: true }));
      }
      if (url.includes('/auth/google')) {
        return Promise.resolve(
          makeJsonResponse({
            accessToken: 'tok',
            accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
            user: fakeUser,
          }),
        );
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      );
    });

    renderButton();

    await waitFor(() => {
      expect(gis.initialize).toHaveBeenCalled();
    });

    gis.getCallback()!({ credential: 'gis-id-token' });

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/en');
    });
  });

  it('shows GOOGLE_TOKEN_INVALID when the API rejects the credential', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web-client.apps.googleusercontent.com');
    const gis = installGisMock();

    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
        );
      }
      if (url.includes('/auth/providers')) {
        return Promise.resolve(makeJsonResponse({ google: true }));
      }
      if (url.includes('/auth/google')) {
        return Promise.resolve(
          makeJsonResponse({ error: { code: 'GOOGLE_TOKEN_INVALID', message: 'bad' } }, 401),
        );
      }
      return Promise.resolve(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      );
    });

    renderButton();

    await waitFor(() => {
      expect(gis.initialize).toHaveBeenCalled();
    });

    gis.getCallback()!({ credential: 'bad-token' });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.GOOGLE_TOKEN_INVALID);
    });
  });
});
