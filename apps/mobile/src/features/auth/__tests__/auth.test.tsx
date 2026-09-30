import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { catalogs } from '@najme/i18n';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { Pressable, Text } from 'react-native';

import { AuthProvider, useSession } from '@/features/auth/auth-provider';
import { canOfferGoogleSignIn, googleEnvConfigured } from '@/features/auth/google-availability';
import { GoogleSignInButton } from '@/features/auth/google-sign-in-button';
import { SignInForm } from '@/features/auth/sign-in-form';
import { clearSessionTokens, setAccessToken } from '@/lib/api/client';
import { getRefreshToken, setRefreshToken } from '@/lib/api/token-storage';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterCanGoBack = jest.fn(() => false);

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: mockRouterReplace,
      back: mockRouterBack,
      canGoBack: () => mockRouterCanGoBack(),
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

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => ({ data: { idToken: 'google-id-token' }, type: 'success' })),
  },
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
    return (
      <>
        <Text testID="session-loading">loading</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="sign-out-probe"
          onPress={() => void session.signOut()}
        />
      </>
    );
  }
  if (session.state === 'anonymous') {
    return (
      <>
        <Text testID="session-anonymous">anonymous</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="sign-out-probe"
          onPress={() => void session.signOut()}
        />
      </>
    );
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
  mockRouterReplace.mockClear();
  mockRouterBack.mockClear();
  mockRouterCanGoBack.mockReset();
  mockRouterCanGoBack.mockReturnValue(false);
  jest.mocked(googleEnvConfigured).mockReturnValue(false);
  jest.mocked(canOfferGoogleSignIn).mockReturnValue(false);
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

  it('sign-out posts /auth/logout with the stored refresh token and clears SecureStore', async () => {
    await setRefreshToken('rt-alive');
    const logoutBodies: unknown[] = [];
    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse(sessionBody('access', 'rt-alive'));
      }
      if (url.includes('/me')) {
        return makeJsonResponse(me);
      }
      if (url.includes('/auth/logout')) {
        logoutBodies.push(init?.body ? JSON.parse(String(init.body)) : null);
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
    expect(logoutBodies).toEqual([{ refreshToken: 'rt-alive' }]);
  });

  it('cold-start on transient refresh failure stays anonymous without wiping SecureStore', async () => {
    await setRefreshToken('rt-offline');
    jest.mocked(fetch).mockRejectedValue(new TypeError('Network request failed'));

    const screen = await renderWithI18n(
      <Harness>
        <SessionProbe />
      </Harness>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-anonymous')).toBeTruthy();
    });
    expect(await getRefreshToken()).toBe('rt-offline');
  });

  it('sign-out during an in-flight refresh revokes the rotated token', async () => {
    await setRefreshToken('rt-old');

    let releaseRefresh: ((response: Response) => void) | undefined;
    const refreshGate = new Promise<Response>((resolve) => {
      releaseRefresh = resolve;
    });
    const logoutBodies: unknown[] = [];

    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return refreshGate;
      }
      if (url.includes('/me')) {
        return makeJsonResponse(me);
      }
      if (url.includes('/auth/logout')) {
        logoutBodies.push(init?.body ? JSON.parse(String(init.body)) : null);
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
      expect(screen.getByTestId('session-loading')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('sign-out-probe'));
    });

    await act(async () => {
      releaseRefresh?.(makeJsonResponse(sessionBody('access-rotated', 'rt-rotated')));
    });

    await waitFor(async () => {
      expect(await getRefreshToken()).toBeNull();
    });
    expect(logoutBodies).toEqual([{ refreshToken: 'rt-rotated' }]);
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

describe('GoogleSignInButton navigation', () => {
  it('replaces to account after a successful Google sign-in when the stack is empty', async () => {
    jest.mocked(googleEnvConfigured).mockReturnValue(true);
    jest.mocked(canOfferGoogleSignIn).mockReturnValue(true);
    mockRouterCanGoBack.mockReturnValue(false);

    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/providers')) {
        return makeJsonResponse({ google: true, password: true });
      }
      if (url.includes('/auth/google') && init?.method === 'POST') {
        return makeJsonResponse(sessionBody('access-google', 'rt-google'));
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    const screen = await renderWithI18n(
      <Harness>
        <GoogleSignInButton />
      </Harness>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('google-sign-in')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.auth.google.continueWith));
    });

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/account');
    });
    expect(mockRouterBack).not.toHaveBeenCalled();
  });

  it('goes back after a successful Google sign-in when the stack can go back', async () => {
    jest.mocked(googleEnvConfigured).mockReturnValue(true);
    jest.mocked(canOfferGoogleSignIn).mockReturnValue(true);
    mockRouterCanGoBack.mockReturnValue(true);

    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/auth/providers')) {
        return makeJsonResponse({ google: true, password: true });
      }
      if (url.includes('/auth/google') && init?.method === 'POST') {
        return makeJsonResponse(sessionBody('access-google', 'rt-google'));
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    const screen = await renderWithI18n(
      <Harness>
        <GoogleSignInButton />
      </Harness>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('google-sign-in')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText(catalogs.en.auth.google.continueWith));
    });

    await waitFor(() => {
      expect(mockRouterBack).toHaveBeenCalled();
    });
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
