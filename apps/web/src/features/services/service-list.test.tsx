import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, Service } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceList } from './service-list';

const apiRequest = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toast.success(...args),
    error: (...args: unknown[]) => toast.error(...args),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/en/business/11111111-1111-4111-8111-111111111111/services',
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

let listBusiness: Business;
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
      () => listBusiness,
      () => listBusiness,
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

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    businessId: '11111111-1111-4111-8111-111111111111',
    name: 'Cut',
    description: null,
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    price: { amount: 1500, currency: 'EUR' },
    minBookingNoticeMinutes: null,
    bookingHorizonDays: null,
    active: true,
    staffMemberIds: ['33333333-3333-4333-8333-333333333333'],
    customFields: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderList() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ business: catalogs.en.business, errors: catalogs.en.errors }}
    >
      <ServiceList />
    </NextIntlClientProvider>,
  );
}

describe('ServiceList', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    toast.success.mockReset();
    listBusiness = makeBusiness();
    emitBusiness();
  });

  it('shows empty CTA for OWNER', async () => {
    apiRequest.mockResolvedValueOnce([]);
    renderList();
    expect(await screen.findByText(catalogs.en.business.services.emptyCta)).toBeTruthy();
  });

  it('hides manage actions for STAFF', async () => {
    listBusiness = makeBusiness({ myRole: 'STAFF' });
    emitBusiness();
    apiRequest.mockResolvedValueOnce([makeService()]);
    renderList();
    expect(await screen.findByText('Cut')).toBeTruthy();
    expect(screen.queryByRole('link', { name: catalogs.en.business.services.add })).toBeNull();
    expect(screen.queryByRole('link', { name: catalogs.en.business.services.edit })).toBeNull();
  });

  it('deletes after confirmation', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path.endsWith('/services') && (!init || !init.method || init.method === 'GET')) {
        return [makeService()];
      }
      if (init?.method === 'DELETE') return undefined;
      throw new Error(`unexpected ${path}`);
    });
    renderList();
    expect(await screen.findByText('Cut')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: catalogs.en.business.services.delete }));
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.services.deleteConfirm }),
    );
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
