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
};

const meGoogleOnly: Me = {
  ...meWithPassword,
  emailVerified: false,
  hasPassword: false,
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

    expect(getByTestId('account-row-edit-profile')).toBeTruthy();
    expect(getByTestId('account-row-language')).toBeTruthy();
    expect(getByTestId('account-row-change-password')).toBeTruthy();
    expect(getByTestId('account-row-sign-out')).toBeTruthy();
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
