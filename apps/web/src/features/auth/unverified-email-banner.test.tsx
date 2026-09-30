import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';
import type { Me } from '@najme/contracts';

import { AuthProvider, useSession } from './session-context';
import { UnverifiedEmailBanner } from './unverified-email-banner';
import { setAccessToken } from '@/lib/api/client';
import { useEffect, type ReactElement, type ReactNode } from 'react';

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
};

const unverifiedUser: Me = {
  id: 'u1',
  email: 'alice@example.com',
  emailVerified: false,
  displayName: 'Alice',
  avatarUrl: null,
  locale: 'en',
  hasPassword: true,
};

const verifiedUser: Me = { ...unverifiedUser, emailVerified: true };

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Seeds AuthProvider with a known user after the initial refresh fails. */
function SessionSeeder({ me, children }: { me: Me; children: ReactNode }): ReactElement {
  const { signIn, state } = useSession();
  useEffect(() => {
    if (state === 'anonymous') {
      signIn('tok', me);
    }
  }, [me, signIn, state]);
  return <>{children}</>;
}

function renderBanner(me: Me) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <SessionSeeder me={me}>
          <UnverifiedEmailBanner />
        </SessionSeeder>
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('UnverifiedEmailBanner', () => {
  it('is hidden for verified users', async () => {
    renderBanner(verifiedUser);

    await waitFor(() => {
      expect(screen.queryByTestId('unverified-email-banner')).not.toBeInTheDocument();
    });
  });

  it('shows for unverified users and resends', async () => {
    renderBanner(unverifiedUser);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByTestId('unverified-email-banner')).toBeInTheDocument();
    });

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    await user.click(
      screen.getByRole('button', { name: catalogs.en.auth.unverifiedBanner.resend }),
    );

    await waitFor(() => {
      expect(screen.getByText(catalogs.en.auth.unverifiedBanner.resent)).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/auth/verify-email/resend',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
