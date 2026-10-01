import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BusinessStatusBanner } from './business-status-banner';

const apiRequest = vi.fn();

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

const rejectedBusiness = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Salon Ada',
  slug: 'salon-ada',
  categoryId: '22222222-2222-4222-8222-222222222222',
  description: null,
  timezone: 'Europe/Podgorica' as const,
  city: 'PODGORICA' as const,
  address: null,
  contactPhone: null,
  contactEmail: null,
  logoUrl: null,
  coverUrl: null,
  confirmationMode: 'AUTO' as const,
  cancellationWindowMinutes: 120,
  minBookingNoticeMinutes: 60,
  bookingHorizonDays: 60,
  status: 'REJECTED' as const,
  rejectionReason: 'Add more photos.',
  myRole: 'OWNER' as const,
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

describe('BusinessStatusBanner', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows the rejection reason and resubmits', async () => {
    const user = userEvent.setup();
    const onUpdated = vi.fn();
    apiRequest.mockResolvedValue({
      ...rejectedBusiness,
      status: 'PENDING_APPROVAL',
      rejectionReason: null,
    });

    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BusinessStatusBanner business={rejectedBusiness} onUpdated={onUpdated} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Add more photos.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: catalogs.en.business.status.resubmit }));
    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        `/businesses/${rejectedBusiness.id}/resubmit`,
        expect.objectContaining({ method: 'POST' }),
      );
      expect(onUpdated).toHaveBeenCalled();
    });
  });

  it('hides resubmit for STAFF', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <BusinessStatusBanner
          business={{ ...rejectedBusiness, myRole: 'STAFF' }}
          onUpdated={vi.fn()}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: catalogs.en.business.status.resubmit })).toBeNull();
  });
});
