import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminBusinessesView } from './admin-businesses-view';

const apiRequest = vi.fn();
const notFound = vi.fn();
const replace = vi.fn();

const sessionState = {
  state: 'authenticated' as 'loading' | 'anonymous' | 'authenticated',
  isPlatformAdmin: true,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  notFound: (...args: unknown[]) => notFound(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(code: string, message: string, status = 500) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

vi.mock('@/features/auth/session-context', () => ({
  useSession: () => {
    if (sessionState.state !== 'authenticated') {
      return { state: sessionState.state, signIn: vi.fn(), signOut: vi.fn(), updateMe: vi.fn() };
    }
    return {
      state: 'authenticated',
      me: {
        id: 'u1',
        email: 'admin@example.com',
        emailVerified: true,
        displayName: 'Admin',
        avatarUrl: null,
        locale: 'en',
        hasPassword: true,
        isPlatformAdmin: sessionState.isPlatformAdmin,
      },
      signIn: vi.fn(),
      signOut: vi.fn(),
      updateMe: vi.fn(),
    };
  },
}));

const listItem = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salon Ada',
  slug: 'salon-ada',
  status: 'PENDING_APPROVAL' as const,
  city: 'PODGORICA' as const,
  categoryId: '22222222-2222-4222-8222-222222222222',
  categoryName: 'Hair',
  ownerEmail: 'owner@example.com',
  ownerEmailVerified: true,
  staffCount: 1,
  servicesCount: 2,
  staffWithWorkingHoursCount: 1,
  rejectionReason: null,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
  approvedAt: null,
  reviewedAt: null,
};

const listItemTwo = {
  ...listItem,
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Barber Max',
  city: 'BAR' as const,
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  admin: catalogs.en.admin,
};

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AdminBusinessesView />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  notFound.mockReset();
  replace.mockReset();
  sessionState.state = 'authenticated';
  sessionState.isPlatformAdmin = true;
  apiRequest.mockImplementation(async (path: string) => {
    if (typeof path === 'string' && path.includes('/approve')) {
      return { ...listItem, status: 'APPROVED' };
    }
    if (typeof path === 'string' && path.includes('/reject')) {
      return { ...listItem, status: 'REJECTED', rejectionReason: 'Needs more photos.' };
    }
    return { items: [listItem], nextCursor: null };
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AdminBusinessesView', () => {
  it('lists pending businesses and approves the selected one', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getAllByText('Salon Ada').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(catalogs.en.common.cities.PODGORICA).length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: catalogs.en.admin.actions.approve }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/admin/businesses/${listItem.id}/approve`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('switches tabs and requests the matching status', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('status=PENDING_APPROVAL'));
    });

    await user.click(screen.getByRole('tab', { name: catalogs.en.admin.tabs.rejected }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining('status=REJECTED'));
    });
  });

  it('appends the next page when Load more is clicked', async () => {
    const user = userEvent.setup();
    const calls: string[] = [];
    apiRequest.mockImplementation(async (path: string) => {
      calls.push(String(path));
      if (String(path).includes('cursor=')) {
        return { items: [listItemTwo], nextCursor: null };
      }
      return { items: [listItem], nextCursor: 'cursor-1' };
    });

    renderView();

    await waitFor(() => {
      expect(screen.getAllByText('Salon Ada').length).toBeGreaterThan(0);
    });
    expect(screen.getByRole('button', { name: catalogs.en.admin.list.loadMore })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: catalogs.en.admin.list.loadMore }));
    await waitFor(() => {
      expect(calls.some((p) => p.includes('cursor=cursor-1'))).toBe(true);
      expect(screen.getByText('Barber Max')).toBeInTheDocument();
    });
  });

  it('shows empty and error/retry states', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api/client');
    let allowSuccess = false;
    apiRequest.mockImplementation(async () => {
      if (!allowSuccess) throw new ApiError('INTERNAL_ERROR', 'boom', 500);
      return { items: [], nextCursor: null };
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText(catalogs.en.errors.INTERNAL_ERROR)).toBeInTheDocument();
    });
    allowSuccess = true;
    await user.click(screen.getByRole('button', { name: catalogs.en.admin.list.retry }));
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.admin.list.empty)).toBeInTheDocument();
    });
  });

  it('validates and posts the reject dialog', async () => {
    const user = userEvent.setup();
    renderView();

    await waitFor(() => {
      expect(screen.getAllByText('Salon Ada').length).toBeGreaterThan(0);
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.admin.actions.reject }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox'), 'Incomplete profile, please add photos.');
    await user.click(
      within(dialog).getByRole('button', { name: catalogs.en.admin.actions.rejectConfirm }),
    );
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/admin/businesses/${listItem.id}/reject`,
        expect.objectContaining({
          method: 'POST',
          body: { reason: 'Incomplete profile, please add photos.' },
        }),
      );
    });
  });

  it('calls notFound for a non-admin', async () => {
    sessionState.isPlatformAdmin = false;
    renderView();
    await waitFor(() => {
      expect(notFound).toHaveBeenCalled();
    });
  });

  it('redirects anonymous users to sign-in', async () => {
    sessionState.state = 'anonymous';
    renderView();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(expect.stringContaining('/en/sign-in?next='));
    });
  });
});
