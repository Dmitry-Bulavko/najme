import { render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { catalogs } from '@najme/i18n';

import { AuthProvider } from './session-context';
import { VerifyEmailPanel } from './verify-email-panel';
import { setAccessToken } from '@/lib/api/client';

const getParam = vi.fn<() => string | null>(() => 'verify-token');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
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

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AuthProvider>
        <VerifyEmailPanel />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  setAccessToken(null);
  getParam.mockReturnValue('verify-token');
  vi.stubGlobal('fetch', vi.fn());
  window.history.replaceState({}, '', '/en/verify-email?token=verify-token');
  vi.spyOn(window.history, 'replaceState');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('VerifyEmailPanel', () => {
  it('shows missing-token when the query has no token', async () => {
    getParam.mockReturnValue(null);
    // Initial session refresh → anonymous
    vi.mocked(fetch).mockResolvedValueOnce(
      makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        catalogs.en.auth.emailVerification.missingToken,
      );
    });
  });

  it('strips token from the URL after reading it', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderPanel();

    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });
    const calls = vi.mocked(window.history.replaceState).mock.calls;
    const nextUrl = calls.find(
      (call) => typeof call[2] === 'string' && !String(call[2]).includes('token='),
    )?.[2];
    expect(nextUrl).toBeDefined();
  });

  it('shows success after a 204 verify response', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        catalogs.en.auth.emailVerification.successTitle,
      );
    });
  });

  it('shows TOKEN_INVALID from the API and offers Resend via sign-in', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401),
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'TOKEN_INVALID', message: 'bad' } }, 400),
      );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(catalogs.en.errors.TOKEN_INVALID);
    });
    expect(
      screen.getByRole('link', { name: catalogs.en.auth.emailVerification.resend }),
    ).toHaveAttribute('href', '/en/sign-in');
  });
});
