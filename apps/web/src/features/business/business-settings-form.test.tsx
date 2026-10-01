import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessSettingsForm } from './business-settings-form';

const apiRequest = vi.fn();
const setBusiness = vi.fn();
const replace = vi.fn();
const clearLastBusinessId = vi.fn();
const invalidateMyBusinesses = vi.fn(async () => undefined);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
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

let settingsBusiness: Business;

vi.mock('./business-shell', () => ({
  useBusinessContext: () => ({
    business: settingsBusiness,
    setBusiness,
    reload: async () => undefined,
  }),
}));

vi.mock('./last-business', () => ({
  clearLastBusinessId: (...args: unknown[]) => clearLastBusinessId(...args),
}));

vi.mock('./use-my-businesses', () => ({
  useInvalidateMyBusinesses: () => invalidateMyBusinesses,
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

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

function renderSettings() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <BusinessSettingsForm />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiRequest.mockReset();
  setBusiness.mockReset();
  replace.mockReset();
  clearLastBusinessId.mockReset();
  invalidateMyBusinesses.mockReset();
  invalidateMyBusinesses.mockResolvedValue(undefined);
  settingsBusiness = makeBusiness();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BusinessSettingsForm', () => {
  it('PATCHes only dirty fields so a non-preset notice survives', async () => {
    const user = userEvent.setup();
    settingsBusiness = makeBusiness({ minBookingNoticeMinutes: 45 });
    apiRequest.mockImplementation(async (_path, init?: { method?: string; body?: unknown }) => {
      if (init?.method === 'PATCH') {
        return { ...settingsBusiness, ...(init.body as object) };
      }
      throw new Error('unexpected');
    });
    renderSettings();
    expect(
      screen.getByRole('combobox', { name: catalogs.en.business.settings.minNotice }),
    ).toHaveTextContent(/45/);
    await user.click(screen.getByRole('radio', { name: /Manual/i }));
    await user.click(screen.getByRole('button', { name: catalogs.en.business.settings.save }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${settingsBusiness.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: { confirmationMode: 'MANUAL' },
        }),
      );
    });
    const patchBody = apiRequest.mock.calls.find(
      (call) => (call[1] as { method?: string } | undefined)?.method === 'PATCH',
    )?.[1] as { body: Record<string, unknown> };
    expect(patchBody.body).not.toHaveProperty('minBookingNoticeMinutes');
  });

  it('shows forbidden for STAFF', () => {
    settingsBusiness = makeBusiness({ myRole: 'STAFF' });
    renderSettings();
    expect(screen.getByText(catalogs.en.business.settings.forbidden)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: catalogs.en.business.settings.save })).toBeNull();
  });

  it('hides the danger zone for ADMIN', () => {
    settingsBusiness = makeBusiness({ myRole: 'ADMIN' });
    renderSettings();
    expect(screen.queryByRole('button', { name: catalogs.en.business.settings.delete })).toBeNull();
  });

  it('keeps delete confirm disabled for a wrong name', async () => {
    const user = userEvent.setup();
    renderSettings();
    await user.click(screen.getByRole('button', { name: catalogs.en.business.settings.delete }));
    await user.type(
      screen.getByLabelText(catalogs.en.business.settings.deleteConfirmLabel),
      'Wrong Name',
    );
    expect(
      screen.getByRole('button', { name: catalogs.en.business.settings.deleteConfirm }),
    ).toBeDisabled();
  });

  it('deletes after typing the business name and clears local state (OWNER)', async () => {
    const user = userEvent.setup();
    apiRequest.mockResolvedValue(undefined);
    renderSettings();
    await user.click(screen.getByRole('button', { name: catalogs.en.business.settings.delete }));
    await user.type(
      screen.getByLabelText(catalogs.en.business.settings.deleteConfirmLabel),
      'Salon Ada',
    );
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.settings.deleteConfirm }),
    );
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(`/businesses/${settingsBusiness.id}`, {
        method: 'DELETE',
      });
    });
    expect(clearLastBusinessId).toHaveBeenCalled();
    expect(invalidateMyBusinesses).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/en');
  });
});
