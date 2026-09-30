import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminBusinessesView } from './admin-businesses-view';

const apiRequest = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  notFound: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

vi.mock('@/features/auth/session-context', () => ({
  useSession: () => ({
    state: 'authenticated',
    me: {
      id: 'u1',
      email: 'admin@example.com',
      emailVerified: true,
      displayName: 'Admin',
      avatarUrl: null,
      locale: 'en',
      hasPassword: true,
      isPlatformAdmin: true,
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    updateMe: vi.fn(),
  }),
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

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  admin: catalogs.en.admin,
};

beforeEach(() => {
  apiRequest.mockReset();
  apiRequest.mockImplementation(async (path: string, opts?: { method?: string }) => {
    if (typeof path === 'string' && path.includes('/approve')) {
      return { ...listItem, status: 'APPROVED' };
    }
    if (opts?.method === 'POST') {
      return { ...listItem, status: 'APPROVED' };
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

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <AdminBusinessesView />
      </NextIntlClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Salon Ada').length).toBeGreaterThan(0);
    });

    await user.click(screen.getByRole('button', { name: catalogs.en.admin.actions.approve }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/admin/businesses/${listItem.id}/approve`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
