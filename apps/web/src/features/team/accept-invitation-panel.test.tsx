import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AcceptInvitationPanel } from './accept-invitation-panel';
import { INVITE_TOKEN_STORAGE_KEY } from './invite-token-storage';

const apiRequest = vi.fn();
const replace = vi.fn();
const writeLastBusinessId = vi.fn();
const invalidateMyBusinesses = vi.fn();
const signOut = vi.fn(async () => undefined);
const getParam = vi.fn<() => string | null>(() => 'invite-token');

let sessionState: 'loading' | 'anonymous' | 'authenticated' = 'authenticated';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({ get: getParam }),
}));

vi.mock('@/lib/api/client', () => {
  class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  }
  return {
    ApiError,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});

vi.mock('@/features/business/last-business', () => ({
  writeLastBusinessId: (...args: unknown[]) => writeLastBusinessId(...args),
}));

vi.mock('@/features/business/use-my-businesses', () => ({
  useInvalidateMyBusinesses: () => invalidateMyBusinesses,
}));

vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({
    state: sessionState,
    me:
      sessionState === 'authenticated'
        ? {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            email: 'user@example.com',
            emailVerified: true,
            displayName: 'User',
            avatarUrl: null,
            locale: 'en',
            hasPassword: true,
            isPlatformAdmin: false,
          }
        : undefined,
    signIn: vi.fn(),
    signOut,
    updateMe: vi.fn(),
  }),
}));

const preview = {
  businessName: 'Salon Ada',
  logoUrl: null,
  role: 'ADMIN' as const,
  inviterDisplayName: 'Owner',
  emailMasked: 'n***@example.com',
  expiresAt: '2026-10-08T10:00:00.000Z',
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

function renderPanel() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AcceptInvitationPanel />
    </NextIntlClientProvider>,
  );
}

describe('AcceptInvitationPanel', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    replace.mockReset();
    writeLastBusinessId.mockReset();
    invalidateMyBusinesses.mockReset();
    signOut.mockReset();
    getParam.mockReturnValue('invite-token');
    sessionState = 'authenticated';
    sessionStorage.clear();
    window.history.replaceState({}, '', '/en/invitations/accept?token=invite-token');
    vi.spyOn(window.history, 'replaceState');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('loads preview, strips token from the URL, and stores it in sessionStorage', async () => {
    apiRequest.mockResolvedValue(preview);
    renderPanel();
    expect(await screen.findByTestId('invite-accept-preview')).toBeTruthy();
    expect(screen.getByText(/Salon Ada/)).toBeTruthy();
    expect(screen.getByText(/n\*\*\*@example.com/)).toBeTruthy();
    await waitFor(() => {
      expect(window.history.replaceState).toHaveBeenCalled();
    });
    const nextUrl = vi.mocked(window.history.replaceState).mock.calls[0]?.[2];
    expect(String(nextUrl)).not.toContain('token=');
    expect(sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY)).toBe('invite-token');
  });

  it('shows locale-prefixed sign-in/up next links when anonymous', async () => {
    sessionState = 'anonymous';
    apiRequest.mockResolvedValue(preview);
    renderPanel();
    expect(await screen.findByTestId('invite-accept-preview')).toBeTruthy();
    const signIn = screen.getByRole('link', { name: catalogs.en.business.inviteAccept.signIn });
    const signUp = screen.getByRole('link', { name: catalogs.en.business.inviteAccept.signUp });
    expect(signIn.getAttribute('href')).toBe(
      `/en/sign-in?next=${encodeURIComponent('/en/invitations/accept')}`,
    );
    expect(signUp.getAttribute('href')).toBe(
      `/en/sign-up?next=${encodeURIComponent('/en/invitations/accept')}`,
    );
  });

  it('accepts successfully and navigates to the business dashboard', async () => {
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path.startsWith('/invitations/preview')) return preview;
      if (path === '/invitations/accept' && init?.method === 'POST') {
        return {
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'user@example.com',
          displayName: 'User',
          role: 'ADMIN',
          staffMemberId: null,
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        };
      }
      if (path === '/me/businesses') {
        return [
          {
            businessId: '11111111-1111-4111-8111-111111111111',
            name: 'Salon Ada',
            slug: 'salon-ada',
            status: 'APPROVED',
            role: 'ADMIN',
            staffMemberId: null,
            logoUrl: null,
          },
        ];
      }
      throw new Error(`unexpected ${path}`);
    });
    renderPanel();
    await userEvent.click(
      await screen.findByRole('button', { name: catalogs.en.business.inviteAccept.accept }),
    );
    await waitFor(() => {
      expect(writeLastBusinessId).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
      expect(invalidateMyBusinesses).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith('/en/business/11111111-1111-4111-8111-111111111111');
      expect(sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  it('shows mismatch with masked email and sign-out', async () => {
    const { ApiError } = await import('@/lib/api/client');
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path.startsWith('/invitations/preview')) return preview;
      if (path === '/invitations/accept' && init?.method === 'POST') {
        throw new ApiError('INVITATION_EMAIL_MISMATCH', 'mismatch', 403);
      }
      throw new Error(`unexpected ${path}`);
    });
    renderPanel();
    await userEvent.click(
      await screen.findByRole('button', { name: catalogs.en.business.inviteAccept.accept }),
    );
    expect(await screen.findByTestId('invite-accept-mismatch')).toBeTruthy();
    expect(screen.getByText(/n\*\*\*@example.com/)).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: catalogs.en.business.inviteAccept.signOut }),
    );
    expect(signOut).toHaveBeenCalled();
  });

  it('shows expired and invalid terminal states and clears the token', async () => {
    const { ApiError } = await import('@/lib/api/client');
    apiRequest.mockRejectedValue(new ApiError('TOKEN_EXPIRED', 'expired', 400));
    renderPanel();
    expect(await screen.findByTestId('invite-accept-terminal')).toBeTruthy();
    expect(screen.getByText(catalogs.en.business.inviteAccept.expiredTitle)).toBeTruthy();
    expect(sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY)).toBeNull();

    getParam.mockReturnValue('bad-token');
    apiRequest.mockRejectedValue(new ApiError('TOKEN_INVALID', 'invalid', 400));
    sessionStorage.clear();
    renderPanel();
    expect(await screen.findByText(catalogs.en.business.inviteAccept.invalidTitle)).toBeTruthy();
  });

  it('restores the token from sessionStorage when the URL has none', async () => {
    getParam.mockReturnValue(null);
    sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, 'stored-token');
    window.history.replaceState({}, '', '/en/invitations/accept');
    apiRequest.mockImplementation(async (path: string) => {
      expect(path).toContain('token=stored-token');
      return preview;
    });
    renderPanel();
    expect(await screen.findByTestId('invite-accept-preview')).toBeTruthy();
  });
});
