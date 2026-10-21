import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessProfileForm } from './business-profile-form';

const apiRequest = vi.fn();
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toast.success(...args),
    error: (...args: unknown[]) => toast.error(...args),
  },
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
  ImageUpload: ({ kind }: { kind: string }) => <div data-testid={`upload-${kind}`} />,
}));

let profileBusiness: Business;
const businessListeners = new Set<() => void>();

function emitBusiness() {
  for (const listener of businessListeners) listener();
}

function setBusinessImpl(update: Business | ((prev: Business) => Business)): void {
  profileBusiness = typeof update === 'function' ? update(profileBusiness) : update;
  emitBusiness();
}

const setBusiness = vi.fn(setBusinessImpl);

vi.mock('./business-shell', () => ({
  useBusinessContext: () => {
    const business = useSyncExternalStore(
      (onStoreChange) => {
        businessListeners.add(onStoreChange);
        return () => businessListeners.delete(onStoreChange);
      },
      () => profileBusiness,
      () => profileBusiness,
    );
    return {
      business,
      setBusiness,
      reload: async () => undefined,
    };
  },
}));

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Salon Ada',
    slug: 'salon-ada',
    categoryId: '22222222-2222-4222-8222-222222222222',
    description: 'A cozy place',
    timezone: 'Europe/Podgorica',
    city: 'PODGORICA',
    address: 'Main 1',
    contactPhone: '+38267000000',
    contactEmail: 'ada@example.com',
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
  setBusiness.mockImplementation(setBusinessImpl);
  toast.success.mockReset();
  toast.error.mockReset();
  profileBusiness = makeBusiness();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BusinessProfileForm', () => {
  it('PATCHes only dirty profile fields for OWNER', async () => {
    const user = userEvent.setup({ delay: null });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (String(path).includes('/categories')) return [category];
        if (init?.method === 'PATCH') {
          return { ...profileBusiness, ...(init.body as object) };
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
          body: { name: 'Salon Novo' },
        }),
      );
    });
    expect(setBusiness).toHaveBeenCalled();
  });

  it('clears dirty state after save so a second PATCH sends only the new change', async () => {
    const user = userEvent.setup({ delay: null });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (String(path).includes('/categories')) return [category];
        if (init?.method === 'PATCH') {
          return { ...profileBusiness, ...(init.body as object) };
        }
        throw new Error(`unexpected ${path}`);
      },
    );
    renderProfile();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: catalogs.en.business.profile.save })).toBeEnabled();
    });

    fireEvent.change(screen.getByLabelText(catalogs.en.business.profile.name), {
      target: { value: 'Salon Novo' },
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${profileBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: { name: 'Salon Novo' },
        }),
      );
    });

    apiRequest.mockClear();
    fireEvent.change(screen.getByLabelText(catalogs.en.business.profile.description), {
      target: { value: 'Updated description' },
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${profileBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: { description: 'Updated description' },
        }),
      );
    });
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('sends null when clearing an optional field', async () => {
    const user = userEvent.setup({ delay: null });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (String(path).includes('/categories')) return [category];
        if (init?.method === 'PATCH') {
          return { ...profileBusiness, description: null };
        }
        throw new Error(`unexpected ${path}`);
      },
    );
    renderProfile();
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.profile.description)).toBeInTheDocument();
    });
    const description = screen.getByLabelText(catalogs.en.business.profile.description);
    fireEvent.change(description, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${profileBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: { description: null },
        }),
      );
    });
  });

  it('maps SLUG_TAKEN to the slug field', async () => {
    const { ApiError } = await import('@/lib/api/client');
    const user = userEvent.setup({ delay: null });
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (String(path).includes('/categories')) return [category];
      if (init?.method === 'PATCH') {
        throw new ApiError('SLUG_TAKEN', 'taken', 409);
      }
      throw new Error(`unexpected ${path}`);
    });
    renderProfile();
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.profile.slug)).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText(catalogs.en.business.profile.slug), {
      target: { value: 'taken-slug' },
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.errors.SLUG_TAKEN)).toBeInTheDocument();
    });
  });

  it('locks the slug when APPROVED and omits it from PATCH', async () => {
    const user = userEvent.setup({ delay: null });
    profileBusiness = makeBusiness({ status: 'APPROVED', slug: 'Grandfathered_Slug!' });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (String(path).includes('/categories')) return [category];
        if (init?.method === 'PATCH') {
          return { ...profileBusiness, ...(init.body as object) };
        }
        throw new Error(`unexpected ${path}`);
      },
    );
    renderProfile();
    await waitFor(() => {
      expect(screen.getByLabelText(catalogs.en.business.profile.slug)).toBeDisabled();
    });
    fireEvent.change(screen.getByLabelText(catalogs.en.business.profile.name), {
      target: { value: 'Salon Locked' },
    });
    await user.click(screen.getByRole('button', { name: catalogs.en.business.profile.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${profileBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: { name: 'Salon Locked' },
        }),
      );
    });
    const patchCall = apiRequest.mock.calls.find(
      (call) => (call[1] as { method?: string } | undefined)?.method === 'PATCH',
    );
    expect(patchCall?.[1]).not.toEqual(
      expect.objectContaining({ body: expect.objectContaining({ slug: expect.anything() }) }),
    );
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
