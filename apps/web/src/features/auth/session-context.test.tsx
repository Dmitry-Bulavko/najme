import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { useSession, AuthProvider } from './session-context';
import { setAccessToken } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  hasPassword: true,
};

const fakeSession = {
  accessToken: 'acc-tok',
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: fakeUser,
};

function SessionDisplay() {
  const session = useSession();
  if (session.state === 'loading') return <div data-testid="loading">loading</div>;
  if (session.state === 'anonymous') return <div data-testid="anonymous">anonymous</div>;
  return <div data-testid="authenticated">{session.me.displayName ?? session.me.email}</div>;
}

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
};

function renderProvider() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <SessionDisplay />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthProvider', () => {
  it('starts in loading state, then resolves to authenticated when refresh + me succeed', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeJsonResponse(fakeSession)) // POST /auth/refresh
      .mockResolvedValueOnce(makeJsonResponse(fakeUser)); // GET /me

    renderProvider();

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toBeInTheDocument();
    });
    expect(screen.getByTestId('authenticated')).toHaveTextContent('Alice');
  });

  it('resolves to anonymous when refresh returns non-2xx', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('anonymous')).toBeInTheDocument();
    });
  });

  it('resolves to anonymous when /me returns invalid data', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeJsonResponse(fakeSession)) // refresh succeeds
      .mockResolvedValueOnce(makeJsonResponse({ unexpected: true })); // /me returns garbage

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('anonymous')).toBeInTheDocument();
    });
  });
});

describe('useSession — signOut', () => {
  it('calls POST /auth/logout and transitions back to anonymous', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(makeJsonResponse(fakeSession))
      .mockResolvedValueOnce(makeJsonResponse(fakeUser))
      .mockResolvedValueOnce(new Response(null, { status: 204 })); // logout

    function SignOutButton() {
      const session = useSession();
      if (session.state !== 'authenticated') return null;
      return <button onClick={() => void session.signOut()}>sign out</button>;
    }

    const { getByRole } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AuthProvider>
          <SessionDisplay />
          <SignOutButton />
        </AuthProvider>
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toBeInTheDocument();
    });

    await getByRole('button', { name: 'sign out' }).click();

    await waitFor(() => {
      expect(screen.getByTestId('anonymous')).toBeInTheDocument();
    });
  });
});
