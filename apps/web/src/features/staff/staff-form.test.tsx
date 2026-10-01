import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffForm } from './staff-form';

const apiRequest = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };
const push = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toast.success(...args),
    error: (...args: unknown[]) => toast.error(...args),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/en/business/11111111-1111-4111-8111-111111111111/staff/new',
}));

vi.mock('@/lib/api/client', () => {
  class ApiError extends Error {
    code: string;
    status: number;
    details?: Record<string, unknown>;
    constructor(code: string, message: string, status = 500, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
    }
  }
  return {
    ApiError,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});

vi.mock('@/features/uploads/image-upload', () => ({
  ImageUpload: () => <div data-testid="image-upload" />,
}));

let formBusiness: Business;
const businessListeners = new Set<() => void>();

function emitBusiness() {
  for (const listener of businessListeners) listener();
}

vi.mock('@/features/business/business-shell', () => ({
  useBusinessContext: () => {
    const business = useSyncExternalStore(
      (onStoreChange) => {
        businessListeners.add(onStoreChange);
        return () => businessListeners.delete(onStoreChange);
      },
      () => formBusiness,
      () => formBusiness,
    );
    return { business, setBusiness: vi.fn(), reload: async () => undefined };
  },
}));

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Salon Ada',
    slug: 'salon-ada',
    categoryId: '22222222-2222-4222-8222-222222222222',
    description: null,
    timezone: 'Europe/Podgorica',
    city: 'PODGORICA',
    address: null,
    contactPhone: null,
    contactEmail: null,
    logoUrl: null,
    coverUrl: null,
    confirmationMode: 'AUTO',
    cancellationWindowMinutes: 120,
    minBookingNoticeMinutes: 60,
    bookingHorizonDays: 60,
    status: 'APPROVED',
    rejectionReason: null,
    myRole: 'OWNER',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    businessId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('StaffForm', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    push.mockReset();
    formBusiness = makeBusiness();
    emitBusiness();
  });

  it('creates a staff member and redirects to edit', async () => {
    const user = userEvent.setup();
    const created = makeStaff();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.endsWith('/staff') && init?.method === 'POST') {
          expect(init.body).toEqual({ displayName: 'Ana', active: true });
          return created;
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ business: catalogs.en.business, errors: catalogs.en.errors }}
      >
        <StaffForm mode="create" />
      </NextIntlClientProvider>,
    );

    await user.type(screen.getByLabelText(catalogs.en.business.staff.name), 'Ana');
    await user.click(screen.getByRole('button', { name: catalogs.en.business.staff.createSubmit }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith(`/en/business/${formBusiness.id}/staff/${created.id}`);
    });
  });

  it('PATCHes edits and shows the saved toast', async () => {
    const user = userEvent.setup();
    const existing = makeStaff();
    let patched: unknown;
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.includes('/staff/') && (!init || !init.method || init.method === 'GET')) {
          return existing;
        }
        if (path.includes('/staff/') && init?.method === 'PATCH') {
          patched = init.body;
          return { ...existing, displayName: 'Ana Markovic' };
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    render(
      <NextIntlClientProvider
        locale="en"
        messages={{ business: catalogs.en.business, errors: catalogs.en.errors }}
      >
        <StaffForm mode="edit" staffId={existing.id} />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByDisplayValue('Ana')).toBeTruthy();
    const name = screen.getByLabelText(catalogs.en.business.staff.name);
    await user.clear(name);
    await user.type(name, 'Ana Markovic');
    await user.click(screen.getByRole('button', { name: catalogs.en.business.staff.save }));

    await waitFor(() => {
      expect(patched).toEqual({ displayName: 'Ana Markovic', active: true });
      expect(toast.success).toHaveBeenCalledWith(catalogs.en.business.staff.savedToast);
    });
  });
});
