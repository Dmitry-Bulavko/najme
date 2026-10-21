import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Business, StaffMember, TimeOff } from '@najme/contracts';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';

import { StaffScheduleView } from './staff-schedule-view';
import { WorkingHoursEditor } from './working-hours-editor';

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
  usePathname: () =>
    '/en/business/11111111-1111-4111-8111-111111111111/staff/33333333-3333-4333-8333-333333333333/schedule',
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
let membershipsError = false;

vi.mock('@/features/business/use-my-businesses', () => ({
  useMyBusinesses: () => ({
    data: membershipsError
      ? undefined
      : [
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
    isError: membershipsError,
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

const staffId = '33333333-3333-4333-8333-333333333333';
const otherStaffId = '44444444-4444-4444-8444-444444444444';
const businessId = '11111111-1111-4111-8111-111111111111';

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

function makeTimeOff(overrides: Partial<TimeOff> = {}): TimeOff {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    staffMemberId: staffId,
    startsAt: '2026-08-01T08:00:00.000Z',
    endsAt: '2026-08-02T08:00:00.000Z',
    reason: null,
    conflictingBookings: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
    ...overrides,
  };
}

function routeFor(path: string): unknown {
  if (path === `/businesses/${businessId}/staff/${staffId}`) return makeStaff();
  if (path === `/businesses/${businessId}/staff/${staffId}/working-hours`) {
    return {
      intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }],
    };
  }
  if (path.startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
    return [];
  }
  throw new Error(`Unexpected path ${path}`);
}

function renderView(id = staffId) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <StaffScheduleView staffId={id} />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  formBusiness = makeBusiness();
  myStaffMemberId = staffId;
  membershipsError = false;
  apiRequest.mockReset();
  toast.success.mockReset();
  toast.error.mockReset();
  apiRequest.mockImplementation(async (path: string) => routeFor(String(path)));
});

describe('StaffScheduleView', () => {
  it('shows the Europe/Podgorica timezone label', async () => {
    renderView();
    expect(await screen.findByTestId('timezone-label')).toHaveTextContent('Europe/Podgorica');
  });

  it('loads hours and PUTs replace-all body on save', async () => {
    const user = userEvent.setup();
    renderView();
    expect(await screen.findByText('Working hours')).toBeInTheDocument();

    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'PUT') {
          return { intervals: (init.body as { intervals: unknown }).intervals };
        }
        return routeFor(String(path));
      },
    );

    await user.click(screen.getByRole('button', { name: 'Save hours' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/working-hours`,
        expect.objectContaining({
          method: 'PUT',
          body: {
            intervals: [{ weekday: 'MONDAY', start: '09:00', end: '17:00' }],
          },
        }),
      );
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows load error and Retry', async () => {
    const user = userEvent.setup();
    let fail = true;
    apiRequest.mockImplementation(async (path: string) => {
      if (fail && String(path).includes('/working-hours')) {
        throw new ApiError('INTERNAL_ERROR', 'boom', 500);
      }
      return routeFor(String(path));
    });
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent(catalogs.en.errors.INTERNAL_ERROR);
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Working hours')).toBeInTheDocument();
  });

  it('shows 403 for STAFF opening another staff schedule', async () => {
    formBusiness = makeBusiness({ myRole: 'STAFF' });
    myStaffMemberId = staffId;
    renderView(otherStaffId);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have access to this schedule.',
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('shows noLinkedStaff for unlinked STAFF', async () => {
    formBusiness = makeBusiness({ myRole: 'STAFF' });
    myStaffMemberId = null;
    renderView(staffId);
    expect(await screen.findByRole('status')).toHaveTextContent(
      catalogs.en.business.schedule.noLinkedStaff,
    );
    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('creates all-day time off with next-day 00:00 and shows conflict warning', async () => {
    const user = userEvent.setup();
    const created = makeTimeOff({ conflictingBookings: [] });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'POST' && String(path).endsWith('/time-off')) {
          return created;
        }
        return routeFor(String(path));
      },
    );

    renderView();
    await screen.findByText('Time off');
    await user.click(screen.getByRole('button', { name: 'Add time off' }));

    const dialog = await screen.findByRole('dialog');
    const startDate = within(dialog).getByLabelText('Start date');
    const endDate = within(dialog).getByLabelText('End date');
    fireEvent.change(startDate, { target: { value: '2026-09-10' } });
    fireEvent.change(endDate, { target: { value: '2026-09-10' } });
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    expect(await screen.findByText('Conflicting bookings')).toBeInTheDocument();
    expect(screen.getByText(/No conflicting bookings were found/)).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith(
      `/businesses/${businessId}/staff/${staffId}/time-off`,
      expect.objectContaining({
        method: 'POST',
        body: {
          start: '2026-09-10T00:00',
          end: '2026-09-11T00:00',
        },
      }),
    );
  });

  it('submits timed time-off body', async () => {
    const user = userEvent.setup();
    const created = makeTimeOff({
      startsAt: '2026-09-10T08:00:00.000Z',
      endsAt: '2026-09-10T10:00:00.000Z',
    });
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'POST' && String(path).endsWith('/time-off')) {
          return created;
        }
        return routeFor(String(path));
      },
    );

    renderView();
    await screen.findByText('Time off');
    await user.click(screen.getByRole('button', { name: 'Add time off' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('switch'));
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2026-09-10' },
    });
    fireEvent.change(within(dialog).getByLabelText('End date'), {
      target: { value: '2026-09-10' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/time-off`,
        expect.objectContaining({
          method: 'POST',
          body: expect.objectContaining({
            start: '2026-09-10T09:00',
            end: '2026-09-10T17:00',
          }),
        }),
      );
    });
  });

  it('shows date field errors when submitting empty dates (no throw)', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Time off');
    await user.click(screen.getByRole('button', { name: 'Add time off' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findAllByText('Enter a valid date.')).toHaveLength(2);
    expect(apiRequest.mock.calls.some((c) => c[1]?.method === 'POST')).toBe(false);
  });

  it('deletes upcoming time off', async () => {
    const user = userEvent.setup();
    const entry = makeTimeOff({
      startsAt: '2099-08-01T08:00:00.000Z',
      endsAt: '2099-08-02T08:00:00.000Z',
    });
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (String(path).includes('/time-off/') && init?.method === 'DELETE') {
        return undefined;
      }
      if (String(path).startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
        return [entry];
      }
      return routeFor(String(path));
    });

    renderView();
    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${businessId}/staff/${staffId}/time-off/${entry.id}`,
        { method: 'DELETE' },
      );
    });
  });

  it('toasts on failed PUT without crashing', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Working hours');
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'PUT') {
          throw new ApiError('INTERNAL_ERROR', 'boom', 500);
        }
        return routeFor(String(path));
      },
    );
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('maps failed PUT VALIDATION_FAILED onto interval rows', async () => {
    const user = userEvent.setup();
    renderView();
    await screen.findByText('Working hours');
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'PUT') {
          throw new ApiError('VALIDATION_FAILED', 'invalid', 400, {
            issues: [{ path: ['intervals', 0, 'end'], message: 'bad' }],
          });
        }
        return routeFor(String(path));
      },
    );
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(await screen.findByText(/This interval is invalid/i)).toBeInTheDocument();
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.getByText(/overlapping or invalid/i)).toBeInTheDocument();
  });

  it('toasts on failed POST create', async () => {
    const user = userEvent.setup();
    apiRequest.mockImplementation(
      async (path: string, init?: { method?: string; body?: unknown }) => {
        if (init?.method === 'POST' && String(path).endsWith('/time-off')) {
          throw new ApiError('INTERNAL_ERROR', 'boom', 500);
        }
        return routeFor(String(path));
      },
    );
    renderView();
    await screen.findByText('Time off');
    await user.click(screen.getByRole('button', { name: 'Add time off' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Start date'), {
      target: { value: '2026-09-10' },
    });
    fireEvent.change(within(dialog).getByLabelText('End date'), {
      target: { value: '2026-09-10' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it('toasts on failed DELETE', async () => {
    const user = userEvent.setup();
    const entry = makeTimeOff({
      startsAt: '2099-08-01T08:00:00.000Z',
      endsAt: '2099-08-02T08:00:00.000Z',
    });
    apiRequest.mockImplementation(async (path: string, init?: { method?: string }) => {
      if (String(path).includes('/time-off/') && init?.method === 'DELETE') {
        throw new ApiError('INTERNAL_ERROR', 'boom', 500);
      }
      if (String(path).startsWith(`/businesses/${businessId}/staff/${staffId}/time-off`)) {
        return [entry];
      }
      return routeFor(String(path));
    });
    renderView();
    await screen.findByRole('button', { name: 'Delete' });
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });
});

describe('WorkingHoursEditor', () => {
  it('marks a day closed and does not include it in save payload', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[{ weekday: 'MONDAY', start: '09:00', end: '17:00' }]}
          onSave={onSave}
        />
      </NextIntlClientProvider>,
    );

    const monday = screen.getByText('Monday').closest('li');
    expect(monday).toBeTruthy();
    const closedSwitch = within(monday as HTMLElement).getByRole('switch');
    await user.click(closedSwitch);
    await user.click(screen.getByRole('button', { name: 'Save hours' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([]);
    });
  });

  it('blocks save when intervals overlap and shows per-row errors', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[
            { weekday: 'MONDAY', start: '09:00', end: '12:00' },
            { weekday: 'MONDAY', start: '11:00', end: '14:00' },
          ]}
          onSave={onSave}
        />
      </NextIntlClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    expect(await screen.findByText(/overlapping or invalid/i)).toBeInTheDocument();
    expect(screen.getAllByText(/This interval is invalid/i).length).toBeGreaterThan(0);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('copies Monday hours to Wednesday via keyboard', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[{ weekday: 'MONDAY', start: '10:00', end: '16:00' }]}
          onSave={onSave}
        />
      </NextIntlClientProvider>,
    );

    const monday = screen.getByText('Monday').closest('li') as HTMLElement;
    const copyButton = within(monday).getByRole('button', { name: 'Copy to…' });
    copyButton.focus();
    await user.keyboard('{Enter}');
    const wednesday = await screen.findByLabelText('Wednesday');
    wednesday.focus();
    await user.keyboard(' ');
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    await user.click(screen.getByRole('button', { name: 'Save hours' }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([
        { weekday: 'MONDAY', start: '10:00', end: '16:00' },
        { weekday: 'WEDNESDAY', start: '10:00', end: '16:00' },
      ]);
    });
  });

  it('removes the last interval and closes the day', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[{ weekday: 'MONDAY', start: '09:00', end: '17:00' }]}
          onSave={onSave}
        />
      </NextIntlClientProvider>,
    );

    const monday = screen.getByText('Monday').closest('li') as HTMLElement;
    await user.click(within(monday).getByRole('button', { name: /Remove/i }));
    expect(within(monday).getByRole('switch')).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([]);
    });
  });

  it('saves until-end-of-day as 24:00 via the checkbox', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[{ weekday: 'MONDAY', start: '09:00', end: '17:00' }]}
          onSave={onSave}
        />
      </NextIntlClientProvider>,
    );

    const monday = screen.getByText('Monday').closest('li') as HTMLElement;
    await user.click(within(monday).getByLabelText('Until end of day (24:00)'));
    expect(within(monday).getByText('24:00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save hours' }));
    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([{ weekday: 'MONDAY', start: '09:00', end: '24:00' }]);
    });
  });

  it('shows a locale-formatted day summary', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WorkingHoursEditor
          initialIntervals={[{ weekday: 'MONDAY', start: '09:00', end: '17:00' }]}
          onSave={async () => undefined}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByTestId('day-summary-MONDAY').textContent?.toLowerCase()).toMatch(/9:00/);
  });
});
