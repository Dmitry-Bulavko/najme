import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessProfileForm } from './business-profile-form';

const apiRequest = vi.fn();
const setBusiness = vi.fn();

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api/client', () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    details?: Record<string, unknown>;
    constructor(code: string, message: string, status = 500, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.status = status;
      this.details = details;
    }
  },
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

vi.mock('@/features/uploads/image-upload', () => ({
  ImageUpload: ({ kind }: { kind: string }) => <div data-testid={`upload-${kind}`} />,
}));

let profileBusiness: Business;

vi.mock('./business-shell', () => ({
  useBusinessContext: () => ({
    business: profileBusiness,
    setBusiness,
    reload: async () => undefined,
  }),
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
    status: 'PENDING_APPROVAL',
    rejectionReason: null,
    myRole: 'OWNER',
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

const category = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'beauty',
  name: 'Beauty',
  iconKey: null,
  sortOrder: 0,
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

function renderProfile() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BusinessProfileForm />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  setBusiness.mockReset();
  profileBusiness = makeBusiness();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BusinessProfileForm', () => {
  it('PATCHes profile fields for OWNER', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (String(path).includes('/categories')) return [category];
        if (init?.method === 'PATCH') {
          return { ...profileBusiness, name: (init.body as { name: string }).name };
        }
        throw new Error(`unexpected ${path}`);
      },
    );
    renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: catalogs.en.business.profile.save })).toBeEnabled();
    });
    const name = screen.getByLabelText(catalogs.en.business.profile.name);
    await user.clear(name);
    await user.type(name, 'Salon Novo');
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${profileBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.objectContaining({ name: 'Salon Novo' }),
        }),
      );
    });
    expect(setBusiness).toHaveBeenCalled();
  }, 15_000);

  it('locks the slug when APPROVED', async () => {
    profileBusiness = makeBusiness({ status: 'APPROVED' });
    apiRequest.mockResolvedValue([category]);
    renderProfile();
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.profile.slug)).toBeDisabled();
    });
  });

  it('is read-only for STAFF', async () => {
    profileBusiness = makeBusiness({ myRole: 'STAFF' });
    apiRequest.mockResolvedValue([category]);
    renderProfile();
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.profile.name)).toBeDisabled();
    });
    expect(screen.queryByRole('button', { name: catalogs.en.business.profile.save })).toBeNull();
  });
});
