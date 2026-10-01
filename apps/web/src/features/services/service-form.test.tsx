import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, Service, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceForm } from './service-form';

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
  usePathname: () => '/en/business/11111111-1111-4111-8111-111111111111/services/new',
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

const staffId = '33333333-3333-4333-8333-333333333333';
const inactiveStaffId = '55555555-5555-4555-8555-555555555555';

function makeStaff(overrides: Partial<StaffMember> = {}): StaffMember {
  return {
    id: staffId,
    businessId: '11111111-1111-4111-8111-111111111111',
    displayName: 'Ana',
    photoUrl: null,
    active: true,
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
    staffMemberIds: [staffId],
    customFields: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderCreate() {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ business: catalogs.en.business, errors: catalogs.en.errors }}
    >
      <ServiceForm mode="create" />
    </NextIntlClientProvider>,
  );
}

function renderEdit(serviceId = '44444444-4444-4444-8444-444444444444') {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ business: catalogs.en.business, errors: catalogs.en.errors }}
    >
      <ServiceForm mode="edit" serviceId={serviceId} />
    </NextIntlClientProvider>,
  );
}

async function fillRequiredCreateFields(user: ReturnType<typeof userEvent.setup>) {
  expect(await screen.findByLabelText(catalogs.en.business.services.name)).toBeTruthy();
  const name = screen.getByLabelText(catalogs.en.business.services.name);
  await user.click(name);
  await user.paste('Cut');
  const price = screen.getByLabelText(catalogs.en.business.services.price);
  await user.click(price);
  await user.paste('20');
}

describe('ServiceForm', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
    push.mockReset();
    formBusiness = makeBusiness();
    emitBusiness();
  });

  it('labels duration, buffers, price, notice and horizon for assistive tech', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(async (path: string) => {
      if (path.endsWith('/staff')) return [makeStaff()];
      throw new Error(`unexpected ${path}`);
    });
    renderCreate();
    expect(await screen.findByLabelText(catalogs.en.business.services.duration)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.services.price)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.services.bufferBefore)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.services.bufferAfter)).toBeTruthy();
    await user.click(screen.getByText(catalogs.en.business.services.advancedHeading));
    expect(await screen.findByLabelText(catalogs.en.business.services.minNotice)).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.services.horizon)).toBeTruthy();
  });

  it('maps staffMemberIds VALIDATION_FAILED details onto the staff fieldset', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api/client');
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff')) return [makeStaff()];
      if (path.endsWith('/services') && init?.method === 'POST') {
        throw new ApiError('VALIDATION_FAILED', 'invalid', 422, { staffMemberIds: [staffId] });
      }
      throw new Error(`unexpected ${path}`);
    });

    renderCreate();
    await fillRequiredCreateFields(user);
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.services.createSubmit }),
    );

    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.invalid)).toBeTruthy();
    });
  });

  it('maps server customFields errors onto the matching clientId row', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api/client');
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (path.endsWith('/staff')) return [makeStaff()];
      if (path.endsWith('/services') && init?.method === 'POST') {
        throw new ApiError('VALIDATION_FAILED', 'invalid', 422, {
          issues: [{ path: ['customFields', 0, 'key'] }],
        });
      }
      throw new Error(`unexpected ${path}`);
    });

    renderCreate();
    await fillRequiredCreateFields(user);
    await user.click(screen.getByRole('button', { name: catalogs.en.business.customFields.add }));
    const label = screen.getByLabelText(catalogs.en.business.customFields.label);
    await user.click(label);
    await user.paste('Notes');
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.services.createSubmit }),
    );

    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.services.errors.invalid)).toBeTruthy();
    });
  });

  it('POSTs minor-unit price, staffMemberIds, customFields order and null overrides', async () => {
    const user = userEvent.setup();
    let posted: unknown;
    const created = makeService();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.endsWith('/staff')) return [makeStaff()];
        if (path.endsWith('/services') && init?.method === 'POST') {
          posted = init.body;
          return created;
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    renderCreate();
    await fillRequiredCreateFields(user);
    await user.click(screen.getByLabelText('Ana'));
    await user.click(screen.getByRole('button', { name: catalogs.en.business.customFields.add }));
    const firstLabel = screen.getByLabelText(catalogs.en.business.customFields.label);
    await user.click(firstLabel);
    await user.paste('Notes');
    await user.click(screen.getByRole('button', { name: catalogs.en.business.customFields.add }));
    const labels = screen.getAllByLabelText(catalogs.en.business.customFields.label);
    await user.click(labels[1]!);
    await user.paste('Allergies');

    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.services.createSubmit }),
    );

    await waitFor(() => {
      expect(posted).toBeTruthy();
    });
    const body = posted as {
      price: { amount: number; currency: string };
      staffMemberIds: string[];
      minBookingNoticeMinutes: number | null;
      bookingHorizonDays: number | null;
      customFields: Array<{ key: string; sortOrder: number }>;
    };
    expect(body.price).toEqual({ amount: 2000, currency: 'EUR' });
    expect(body.staffMemberIds).toEqual([staffId]);
    expect(body.minBookingNoticeMinutes).toBeNull();
    expect(body.bookingHorizonDays).toBeNull();
    expect(body.customFields.map((f) => f.key)).toEqual(['notes', 'allergies']);
    expect(body.customFields.map((f) => f.sortOrder)).toEqual([0, 1]);
    expect(push).toHaveBeenCalledWith(`/en/business/${formBusiness.id}/services/${created.id}`);
  });

  it('commits price on Enter during create so amount is not stale 0', async () => {
    const user = userEvent.setup();
    let posted: unknown;
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.endsWith('/staff')) return [makeStaff()];
        if (path.endsWith('/services') && init?.method === 'POST') {
          posted = init.body;
          return makeService();
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    renderCreate();
    expect(await screen.findByLabelText(catalogs.en.business.services.name)).toBeTruthy();
    const name = screen.getByLabelText(catalogs.en.business.services.name);
    await user.click(name);
    await user.paste('Cut');
    const price = screen.getByLabelText(catalogs.en.business.services.price);
    await user.click(price);
    await user.paste('20');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(posted).toBeTruthy();
    });
    expect((posted as { price: { amount: number } }).price.amount).toBe(2000);
  });

  it('PATCHes edits including an updated price committed on Enter', async () => {
    const user = userEvent.setup();
    let patched: unknown;
    const existing = makeService({ price: { amount: 1500, currency: 'EUR' } });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.endsWith('/staff')) return [makeStaff()];
        if (path.includes('/services/') && (!init || !init.method || init.method === 'GET')) {
          return existing;
        }
        if (path.includes('/services/') && init?.method === 'PATCH') {
          patched = init.body;
          return { ...existing, price: { amount: 3500, currency: 'EUR' }, name: 'Fade' };
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    renderEdit();
    expect(await screen.findByDisplayValue('Cut')).toBeTruthy();
    const name = screen.getByLabelText(catalogs.en.business.services.name);
    await user.clear(name);
    await user.click(name);
    await user.paste('Fade');
    const price = screen.getByLabelText(catalogs.en.business.services.price);
    await user.clear(price);
    await user.click(price);
    await user.paste('35');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(patched).toBeTruthy();
    });
    expect((patched as { price: { amount: number }; name: string }).price.amount).toBe(3500);
    expect((patched as { name: string }).name).toBe('Fade');
  });

  it('toasts the catalog formInvalid string for local custom-field validation', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(async (path: string) => {
      if (path.endsWith('/staff')) return [makeStaff()];
      throw new Error(`unexpected ${path}`);
    });

    renderCreate();
    await fillRequiredCreateFields(user);
    await user.click(screen.getByRole('button', { name: catalogs.en.business.customFields.add }));
    await user.click(
      screen.getByRole('button', { name: catalogs.en.business.services.createSubmit }),
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        catalogs.en.business.customFields.errors.formInvalid,
      );
    });
  });

  it('retries after a load error', async () => {
    const user = userEvent.setup();
    const { ApiError } = await import('@/lib/api/client');
    let fail = true;
    apiRequest.mockImplementation(async (path: string) => {
      if (path.endsWith('/staff')) {
        if (fail) {
          fail = false;
          throw new ApiError('INTERNAL_ERROR', 'boom', 500);
        }
        return [makeStaff()];
      }
      if (path.includes('/services/')) return makeService();
      throw new Error(`unexpected ${path}`);
    });

    renderEdit();
    expect(
      await screen.findByRole('button', { name: catalogs.en.business.services.retry }),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: catalogs.en.business.services.retry }));
    expect(await screen.findByDisplayValue('Cut')).toBeTruthy();
  });

  it('locks custom-field keys after a successful save round-trip', async () => {
    const user = userEvent.setup();
    const existing = makeService({
      customFields: [
        {
          id: '88888888-8888-4888-8888-888888888888',
          key: 'notes',
          label: 'Notes',
          type: 'TEXT',
          required: false,
          options: null,
          sortOrder: 0,
        },
      ],
    });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (path.endsWith('/staff')) return [makeStaff()];
        if (path.includes('/services/') && (!init || !init.method || init.method === 'GET')) {
          return existing;
        }
        if (path.includes('/services/') && init?.method === 'PATCH') {
          return existing;
        }
        throw new Error(`unexpected ${path}`);
      },
    );

    renderEdit();
    expect(await screen.findByDisplayValue('Notes')).toBeTruthy();
    expect(screen.getByLabelText(catalogs.en.business.customFields.key)).toBeDisabled();

    await user.click(screen.getByRole('button', { name: catalogs.en.business.services.save }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    expect(screen.getByLabelText(catalogs.en.business.customFields.key)).toBeDisabled();
  });

  it('renders STAFF edit as read-only without a submit button', async () => {
    formBusiness = makeBusiness({ myRole: 'STAFF' });
    emitBusiness();
    apiRequest.mockImplementation(async (path: string) => {
      if (path.endsWith('/staff')) return [makeStaff()];
      if (path.includes('/services/')) return makeService();
      throw new Error(`unexpected ${path}`);
    });

    renderEdit();
    expect(await screen.findByDisplayValue('Cut')).toBeTruthy();
    expect(screen.queryByRole('button', { name: catalogs.en.business.services.save })).toBeNull();
    expect(screen.getByLabelText(catalogs.en.business.services.name)).toBeDisabled();
  });

  it('allows unchecking an inactive assigned staff member', async () => {
    const user = userEvent.setup();
    const inactive = makeStaff({
      id: inactiveStaffId,
      displayName: 'Bojan',
      active: false,
    });
    const existing = makeService({ staffMemberIds: [inactiveStaffId] });
    apiRequest.mockImplementation(async (path: string) => {
      if (path.endsWith('/staff')) return [inactive];
      if (path.includes('/services/')) return existing;
      throw new Error(`unexpected ${path}`);
    });

    renderEdit();
    const checkbox = await screen.findByLabelText(
      catalogs.en.business.services.staffInactiveName.replace('{name}', 'Bojan'),
    );
    expect(checkbox).not.toBeDisabled();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
