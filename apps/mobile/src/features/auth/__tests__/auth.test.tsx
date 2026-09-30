import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useSession } from '@/features/auth/auth-provider';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { SignInForm } from '@/features/auth/sign-in-form';
import { clearSessionTokens, setAccessToken } from '@/lib/api/client';
import { getRefreshToken, setRefreshToken } from '@/lib/api/token-storage';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => false,
    }),
    Link: ({ children }: { children: ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@/features/auth/google-availability', () => ({
  googleEnvConfigured: jest.fn(() => false),
  canOfferGoogleSignIn: jest.fn(() => false),
  isGoogleNativeAvailable: jest.fn(() => false),
}));

jest.mock('@/i18n', () => {
  const actual = jest.requireActual<typeof import('@/i18n')>('@/i18n');
  return {
    ...actual,
    setLocale: jest.fn(async () => undefined),
  };
});

const me = {
  id: 'u1',
  email: 'user@example.com',
  emailVerified: false,
  displayName: 'Ada',
  avatarUrl: null,
  locale: 'en' as const,
  hasPassword: true,
};

function sessionBody(accessToken: string, refreshToken: string) {
  return {
    accessToken,
    accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken,
    user: me,
  };
}

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function Harness({ children }: { children: ReactElement }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function SessionProbe() {
  const session = useSession();
  if (session.state === 'loading') {
    return <Text testID="session-loading">loading</Text>;
  }
  if (session.state === 'anonymous') {
    return <Text testID="session-anonymous">anonymous</Text>;
  }
  return (
    <>
      <Text testID="signed-in-email">{session.me.email}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="sign-out-probe"
        onPress={() => void session.signOut()}
      />
    </>
  );
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(async () => {
  await clearSessionTokens();
  setAccessToken(null);
  jest.restoreAllMocks();
  jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn<typeof fetch>());
});

describe('SignInForm', () => {
  it('shows inline validation for an empty submit', async () => {
    const { getByLabelText, findAllByRole } = await renderWithI18n(
      <Harness>
        <SignInForm />
      </Harness>,
    );

    await act(async () => {
      fireEvent.press(getByLabelText(catalogs.en.auth.signIn.submit));
    });

    const alerts = await findAllByRole('alert');
    expect(alerts.length).toBeGreaterThan(0);
  });

  it('maps API error codes to the errors catalog', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'nope' } }, 401),
      );

    const { getByLabelText, findByText } = await renderWithI18n(
      <Harness>
        <SignInForm />
      </Harness>,
    );

    await act(async () => {
      fireEvent.changeText(getByLabelText(catalogs.en.auth.signIn.emailLabel), 'user@example.com');
      fireEvent.changeText(getByLabelText(catalogs.en.auth.signIn.passwordLabel), 'password1');
      fireEvent.press(getByLabelText(catalogs.en.auth.signIn.submit));
    });

    expect(await findByText(catalogs.en.errors.INVALID_CREDENTIALS)).toBeTruthy();
  });
});

describe('AuthProvider session restore and sign-out', () => {
  it('restores the session on launch from SecureStore via refresh then /me', async () => {
    await setRefreshToken('rt-launch');
    expect(await getRefreshToken()).toBe('rt-launch');

    jest.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse(sessionBody('access', 'rt-2'));
      }
      if (url.endsWith('/me') || url.includes('/me')) {
        return makeJsonResponse(me);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    const screen = await renderWithI18n(
      <Harness>
        <SessionProbe />
      </Harness>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId('session-loading')).toBeNull();
    });

    expect(screen.getByTestId('signed-in-email')).toHaveTextContent('user@example.com');
  });

  it('sign-out clears SecureStore', async () => {
    await setRefreshToken('rt-alive');
    jest.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse(sessionBody('access', 'rt-alive'));
      }
      if (url.includes('/me')) {
        return makeJsonResponse(me);
      }
      if (url.includes('/auth/logout')) {
        return new Response(null, { status: 204 });
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    const screen = await renderWithI18n(
      <Harness>
        <SessionProbe />
      </Harness>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('signed-in-email')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('sign-out-probe'));
    });

    await waitFor(async () => {
      expect(await getRefreshToken()).toBeNull();
    });
  });
});

describe('GoogleSignInButton visibility', () => {
  it('renders nothing when Google env / native module are unavailable', async () => {
    const { queryByTestId } = await renderWithI18n(
      <Harness>
        <GoogleSignInButton />
      </Harness>,
    );

    expect(queryByTestId('google-sign-in')).toBeNull();
  });
});
