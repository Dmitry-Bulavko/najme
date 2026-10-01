import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, StaffMember } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';

import { SchedulePicker } from './schedule-picker';

const apiRequest = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/en/business/11111111-1111-4111-8111-111111111111/schedule',
}));

vi.mock('@/lib/api/client', () => {
  class MockApiError extends Error {
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
    ApiError: MockApiError,
    apiRequest: (...args: unknown[]) => apiRequest(...args),
  };
});

let formBusiness: Business;
const businessListeners = new Set<() => void>();

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

let myStaffMemberId: string | null = '33333333-3333-4333-8333-333333333333';

vi.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({
    data: [
      {
        businessId: '11111111-1111-4111-8111-111111111111',
        name: 'Salon Ada',
        slug: 'salon-ada',
        status: 'APPROVED',
        role: formBusiness.myRole,
        staffMemberId: myStaffMemberId,
        logoUrl: null,
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  auth: catalogs.en.auth,
  business: catalogs.en.business,
};

const businessId = '11111111-1111-4111-8111-111111111111';
const staffId = '33333333-3333-4333-8333-333333333333';

function makeBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: businessId,
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
    id: staffId,
    businessId,
    displayName: 'Ana',
    photoUrl: null,
    active: true,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function renderPicker() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SchedulePicker />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  formBusiness = makeBusiness();
  myStaffMemberId = staffId;
  replace.mockReset();
  apiRequest.mockReset();
});

describe('SchedulePicker', () => {
  it('lists staff for OWNER', async () => {
    apiRequest.mockResolvedValue([
      makeStaff(),
      makeStaff({ id: '44444444-4444-4444-8444-444444444444', displayName: 'Bojan' }),
    ]);
    renderPicker();
    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bojan')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Open schedule' })[0]).toHaveAttribute(
      'href',
      `/en/business/${businessId}/staff/${staffId}/schedule`,
    );
  });

  it('shows empty state with CTA', async () => {
    apiRequest.mockResolvedValue([]);
    renderPicker();
    expect(await screen.findByText(catalogs.en.business.schedule.pickerEmpty)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: catalogs.en.business.schedule.pickerEmptyCta }),
    ).toHaveAttribute('href', `/en/business/${businessId}/staff/new`);
  });

  it('shows error and Retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    apiRequest.mockImplementation(async () => {
      if (fail) throw new ApiError('INTERNAL_ERROR', 'boom', 500);
      return [makeStaff()];
    });
    renderPicker();
    expect(await screen.findByRole('alert')).toHaveTextContent(catalogs.en.errors.INTERNAL_ERROR);
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Ana')).toBeInTheDocument();
  });

  it('redirects linked STAFF to their schedule', async () => {
    formBusiness = makeBusiness({ myRole: 'STAFF' });
    myStaffMemberId = staffId;
    renderPicker();
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith(`/en/business/${businessId}/staff/${staffId}/schedule`);
    });
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('shows noLinkedStaff when STAFF has no link', async () => {
    formBusiness = makeBusiness({ myRole: 'STAFF' });
    myStaffMemberId = null;
    renderPicker();
    expect(await screen.findByRole('status')).toHaveTextContent(
      catalogs.en.business.schedule.noLinkedStaff,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
