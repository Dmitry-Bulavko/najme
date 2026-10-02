import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Me } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';

import { AccountHome } from '@/features/account/account-home';
import { ChangePasswordForm } from '@/features/account/change-password-form';
import { changePasswordWithLock } from '@/features/account/change-password';
import { EditProfileForm } from '@/features/account/edit-profile-form';
import { AccountLanguageSettings } from '@/features/account/language-settings';
import { setLocale } from '@/i18n';
import {
  apiRequest,
  clearSessionTokens,
  getAccessToken,
  setAccessToken,
  withAuthMutex,
} from '@/lib/api/client';
import { getRefreshToken, setRefreshToken } from '@/lib/api/token-storage';
import { initTestI18n, renderWithI18n } from '@/test-utils/i18n';

const mockRouterPush = jest.fn();
const mockUpdateMe = jest.fn();
const mockSignOut = jest.fn(async () => undefined);

const meWithPassword: Me = {
  id: 'u1',
  email: 'user@example.com',
  emailVerified: true,
  displayName: 'Ada Lovelace',
  avatarUrl: null,
  locale: 'en',
  hasPassword: true,
  isPlatformAdmin: false,
};

const meGoogleOnly: Me = {
  ...meWithPassword,
  emailVerified: false,
  hasPassword: false,
  isPlatformAdmin: false,
  displayName: null,
};

let mockSessionMe: Me = meWithPassword;

jest.mock('expo-router', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useRouter: () => ({
      push: mockRouterPush,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: () => true,
    }),
    Redirect: ({ href }: { href: string }) =>
      ReactActual.createElement(ReactActual.Fragment, null, `redirect:${href}`),
    Link: ({ children }: { children: ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  };
});

jest.mock('@/features/auth/auth-provider', () => ({
  useSession: () => ({
    state: 'authenticated' as const,
    me: mockSessionMe,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signInWithGoogle: jest.fn(),
    signOut: mockSignOut,
    updateMe: mockUpdateMe,
  }),
}));

jest.mock('@/i18n', () => {
  const actual = jest.requireActual<typeof import('@/i18n')>('@/i18n');
  return {
    ...actual,
    setLocale: jest.fn(async () => undefined),
  };
});

jest.mock('@/features/health/use-api-status', () => ({
  useApiStatus: () => 'online' as const,
}));

const mockMyBusinessesState: {
  data: {
    businessId: string;
    name: string;
    slug: string;
    status: 'APPROVED';
    role: 'OWNER';
    staffMemberId: null;
    logoUrl: null;
  }[];
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  refetch: jest.Mock;
} = {
  data: [],
  isLoading: false,
  isError: false,
  isSuccess: true,
  refetch: jest.fn(),
};

const mockEnterBusinessMode = jest.fn(
  async (_router: unknown, _businesses: unknown, _options?: unknown) => undefined,
);

jest.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => mockMyBusinessesState,
  useInvalidateMyBusinesses: () => jest.fn(),
}));

jest.mock('@/features/business/enter-mode', () => ({
  enterBusinessMode: (...args: [unknown, unknown, unknown?]) => mockEnterBusinessMode(...args),
  enterClientMode: jest.fn(async () => undefined),
}));

function makeJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeAll(async () => {
  await initTestI18n('en');
});

beforeEach(async () => {
  mockSessionMe = meWithPassword;
  mockRouterPush.mockClear();
  mockUpdateMe.mockClear();
  mockSignOut.mockClear();
  mockEnterBusinessMode.mockClear();
  mockMyBusinessesState.data = [];
  mockMyBusinessesState.isLoading = false;
  mockMyBusinessesState.isError = false;
  mockMyBusinessesState.isSuccess = true;
  mockMyBusinessesState.refetch = jest.fn();
  jest.mocked(setLocale).mockClear();
  await clearSessionTokens();
  setAccessToken(null);
  jest.restoreAllMocks();
  jest.spyOn(globalThis, 'fetch').mockImplementation(jest.fn<typeof fetch>());
});

describe('AccountHome', () => {
  it('renders profile header and settings rows when signed in', async () => {
    const { getByTestId, getByText } = await renderWithI18n(<AccountHome />);

    expect(getByTestId('account-signed-in')).toBeTruthy();
    expect(getByTestId('account-profile-header')).toBeTruthy();
    expect(getByText('Ada Lovelace')).toBeTruthy();
    expect(getByText(meWithPassword.email)).toBeTruthy();
    expect(getByText(catalogs.en.account.verified)).toBeTruthy();

    expect(getByTestId('account-row-business-mode')).toBeTruthy();
    expect(getByTestId('account-row-edit-profile')).toBeTruthy();
    expect(getByTestId('account-row-language')).toBeTruthy();
    expect(getByTestId('account-row-change-password')).toBeTruthy();
    expect(getByTestId('account-row-sign-out')).toBeTruthy();
    expect(getByText(catalogs.en.business.menu.businessMode)).toBeTruthy();
    expect(getByText(catalogs.en.account.settings.editProfile)).toBeTruthy();
    expect(getByText(catalogs.en.common.apiStatus.label)).toBeTruthy();
  });

  it('asks for confirmation before signing out', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    const { getByTestId } = await renderWithI18n(<AccountHome />);

    await act(async () => {
      fireEvent.press(getByTestId('account-row-sign-out'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      catalogs.en.account.signOutConfirm.title,
      catalogs.en.account.signOutConfirm.body,
      expect.arrayContaining([
        expect.objectContaining({ text: catalogs.en.common.actions.cancel }),
        expect.objectContaining({ text: catalogs.en.account.signOutConfirm.confirm }),
      ]),
    );
    expect(mockSignOut).not.toHaveBeenCalled();

    const buttons = alertSpy.mock.calls[0]?.[2] as
      { text?: string; onPress?: () => void }[] | undefined;
    const confirm = buttons?.find((b) => b.text === catalogs.en.account.signOutConfirm.confirm);
    await act(async () => {
      confirm?.onPress?.();
    });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('shows list error subtitle and refetches on press when /me/businesses fails', async () => {
    mockMyBusinessesState.isError = true;
    mockMyBusinessesState.isSuccess = false;
    mockMyBusinessesState.data = [];

    const { getByTestId, getByText } = await renderWithI18n(<AccountHome />);

    expect(getByText(catalogs.en.business.list.error)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('account-row-business-mode'));
    });

    expect(mockMyBusinessesState.refetch).toHaveBeenCalled();
    expect(mockEnterBusinessMode).not.toHaveBeenCalled();
  });

  it('routes to create only when the membership list is successfully empty', async () => {
    mockMyBusinessesState.isSuccess = true;
    mockMyBusinessesState.isError = false;
    mockMyBusinessesState.data = [];

    const { getByTestId, getByText } = await renderWithI18n(<AccountHome />);
    expect(getByText(catalogs.en.business.menu.createBusiness)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('account-row-business-mode'));
    });

    expect(mockEnterBusinessMode).toHaveBeenCalledWith(expect.anything(), []);
  });
});

describe('EditProfileForm', () => {
  it('saves the display name via PATCH /me', async () => {
    const updated = { ...meWithPassword, displayName: 'Ada' };
    jest.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(updated));

    const { getByLabelText } = await renderWithI18n(<EditProfileForm />);

    await act(async () => {
      fireEvent.changeText(
        getByLabelText(catalogs.en.account.profileSection.displayNameLabel),
        'Ada',
      );
    });
    await act(async () => {
      fireEvent.press(getByLabelText(catalogs.en.account.profileSection.save));
    });

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith(updated);
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/me',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});

describe('AccountLanguageSettings', () => {
  it('calls the API and setLocale when picking a locale', async () => {
    const updated = { ...meWithPassword, locale: 'me' as const };
    jest.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(updated));

    const { getByTestId } = await renderWithI18n(<AccountLanguageSettings />);

    await act(async () => {
      fireEvent.press(getByTestId('account-locale-me'));
    });

    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalledWith(updated);
      expect(setLocale).toHaveBeenCalledWith('me');
    });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/me',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('shows saved banner even when setLocale fails after a successful PATCH', async () => {
    const updated = { ...meWithPassword, locale: 'ru' as const };
    jest.mocked(fetch).mockResolvedValueOnce(makeJsonResponse(updated));
    jest.mocked(setLocale).mockRejectedValueOnce(new Error('i18n init failed'));

    const { getByTestId, findByText } = await renderWithI18n(<AccountLanguageSettings />);

    await act(async () => {
      fireEvent.press(getByTestId('account-locale-ru'));
    });

    // Account locale saved server-side → report success regardless of setLocale outcome.
    expect(await findByText(catalogs.en.account.languageSection.saved)).toBeTruthy();
    expect(mockUpdateMe).toHaveBeenCalledWith(updated);
  });
});

describe('ChangePasswordForm', () => {
  it('shows INVALID_CREDENTIALS on the current password field', async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        makeJsonResponse({ error: { code: 'INVALID_CREDENTIALS', message: 'nope' } }, 401),
      );
    setAccessToken('access-old');

    const { getByLabelText, findByText } = await renderWithI18n(<ChangePasswordForm />);

    await act(async () => {
      fireEvent.changeText(
        getByLabelText(catalogs.en.account.passwordSection.currentLabel),
        'wrong-password',
      );
      fireEvent.changeText(
        getByLabelText(catalogs.en.account.passwordSection.newLabel),
        'longenough1',
      );
      fireEvent.changeText(
        getByLabelText(catalogs.en.account.passwordSection.confirmLabel),
        'longenough1',
      );
    });
    await act(async () => {
      fireEvent.press(getByLabelText(catalogs.en.account.passwordSection.save));
    });

    expect(await findByText(catalogs.en.errors.INVALID_CREDENTIALS)).toBeTruthy();
  });

  it('shows the Google-only explanation when hasPassword is false', async () => {
    mockSessionMe = meGoogleOnly;

    const { getByTestId, queryByLabelText } = await renderWithI18n(<ChangePasswordForm />);

    expect(getByTestId('account-password-google-only')).toBeTruthy();
    expect(queryByLabelText(catalogs.en.account.passwordSection.currentLabel)).toBeNull();
  });
});

describe('changePasswordWithLock', () => {
  it('on 401 refreshes inside the mutex without deadlock and retries with new token', async () => {
    setAccessToken('access-expired');
    await setRefreshToken('refresh-initial');

    const sessionAfterRefresh = {
      accessToken: 'access-refreshed',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshToken: 'refresh-refreshed',
      user: meWithPassword,
    };
    const sessionAfterPwChange = {
      accessToken: 'access-final',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshToken: 'refresh-final',
      user: meWithPassword,
    };

    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (url.includes('/me/password')) {
        if (auth === 'Bearer access-expired') {
          return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
        }
        if (auth === 'Bearer access-refreshed') {
          return makeJsonResponse(sessionAfterPwChange);
        }
      }
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse(sessionAfterRefresh);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    const result = await changePasswordWithLock({
      currentPassword: 'old-password',
      newPassword: 'longenough1',
    });

    expect(result.accessToken).toBe('access-final');
    expect(getAccessToken()).toBe('access-final');
    expect(await getRefreshToken()).toBe('refresh-final');
  });

  it('race: concurrent apiRequest 401 refresh uses the new refresh token from password change', async () => {
    setAccessToken('access-old');
    await setRefreshToken('refresh-old');

    const sessionAfterPwChange = {
      accessToken: 'access-pw',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshToken: 'refresh-pw',
      user: meWithPassword,
    };
    const sessionAfterApiRefresh = {
      accessToken: 'access-api',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshToken: 'refresh-api',
      user: meWithPassword,
    };

    let releasePwChange!: (r: Response) => void;
    const pwChangeGate = new Promise<Response>((resolve) => {
      releasePwChange = resolve;
    });
    const refreshBodies: unknown[] = [];

    jest.mocked(fetch).mockImplementation(async (input, init) => {
      const url = String(input);
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (url.includes('/me/password')) {
        return pwChangeGate;
      }
      if (url.includes('/auth/refresh')) {
        refreshBodies.push(init?.body ? JSON.parse(String(init.body)) : null);
        return makeJsonResponse(sessionAfterApiRefresh);
      }
      if (url.includes('/secure')) {
        if (auth === `Bearer ${sessionAfterApiRefresh.accessToken}`) {
          return makeJsonResponse({ ok: true });
        }
        return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    // 1. Start password change (holds mutex, fetch is gated).
    const pwChange = changePasswordWithLock({
      currentPassword: 'old-password',
      newPassword: 'longenough1',
    });

    // 2. Fire a concurrent request that gets 401 → queues refresh behind the mutex.
    const secureRequest = apiRequest('/secure');

    // Let the concurrent request reach the mutex wait without advancing the password fetch.
    await Promise.resolve();
    await Promise.resolve();
    expect(refreshBodies).toEqual([]);

    // 3. Release gate → password change completes, rotating the refresh token.
    releasePwChange(makeJsonResponse(sessionAfterPwChange));

    await expect(pwChange).resolves.toMatchObject({ accessToken: 'access-pw' });
    await expect(secureRequest).resolves.toEqual({ ok: true });

    // The refresh was sent only after the password change resolved, using the NEW refresh token.
    expect(refreshBodies).toEqual([{ refreshToken: 'refresh-pw' }]);
  });

  it('on a second 401 after refresh surfaces UNAUTHENTICATED with one refresh and two password calls', async () => {
    setAccessToken('access-expired');
    await setRefreshToken('refresh-initial');

    let passwordCalls = 0;
    let refreshCalls = 0;

    jest.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        passwordCalls += 1;
        return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
      }
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return makeJsonResponse({
          accessToken: 'access-refreshed',
          accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
          refreshToken: 'refresh-refreshed',
          user: meWithPassword,
        });
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    await expect(
      changePasswordWithLock({ currentPassword: 'old-password', newPassword: 'longenough1' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(passwordCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('clears tokens when refresh returns a definitive rejection', async () => {
    setAccessToken('access-expired');
    await setRefreshToken('refresh-initial');

    jest.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
      }
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse(
          { error: { code: 'REFRESH_TOKEN_REUSED', message: 'reused' } },
          401,
        );
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    await expect(
      changePasswordWithLock({ currentPassword: 'old-password', newPassword: 'longenough1' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });

    expect(getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('keeps tokens when refresh throws a TransientAuthError', async () => {
    setAccessToken('access-expired');
    await setRefreshToken('refresh-initial');

    jest.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/me/password')) {
        return makeJsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, 401);
      }
      if (url.includes('/auth/refresh')) {
        return makeJsonResponse({ error: { code: 'HTTP_ERROR', message: 'down' } }, 503);
      }
      return makeJsonResponse({ error: { code: 'NOT_FOUND', message: url } }, 404);
    });

    await expect(
      changePasswordWithLock({ currentPassword: 'old-password', newPassword: 'longenough1' }),
    ).rejects.toMatchObject({ name: 'TransientAuthError' });

    expect(await getRefreshToken()).toBe('refresh-initial');
  });

  it('persists the rotated refresh token under the auth mutex', async () => {
    setAccessToken('access-old');
    await setRefreshToken('refresh-old');

    const sessionBody = {
      accessToken: 'access-new',
      accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
      refreshToken: 'refresh-new',
      user: meWithPassword,
    };

    let resolveFetch!: (value: Response) => void;
    const fetchGate = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    jest.mocked(fetch).mockReturnValueOnce(fetchGate);

    const passwordChange = changePasswordWithLock({
      currentPassword: 'old-password',
      newPassword: 'longenough1',
    });

    let secondSawNewTokens = false;
    const second = withAuthMutex(async () => {
      secondSawNewTokens =
        getAccessToken() === 'access-new' && (await getRefreshToken()) === 'refresh-new';
      return 2;
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(secondSawNewTokens).toBe(false);

    resolveFetch(makeJsonResponse(sessionBody));
    await expect(passwordChange).resolves.toMatchObject({ accessToken: 'access-new' });
    await expect(second).resolves.toBe(2);
    expect(secondSawNewTokens).toBe(true);
    expect(getAccessToken()).toBe('access-new');
    expect(await getRefreshToken()).toBe('refresh-new');
  });
});
