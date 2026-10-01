import { render, screen, waitFor } from '@testing-library/react';
import { catalogs } from '@najme/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Business } from '@najme/contracts';

import { BusinessOverview } from './business-overview';

const loadChecklist = vi.fn();

vi.mock('./load-checklist', () => ({
  loadChecklist: (...args: unknown[]) => loadChecklist(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const apiRequest = vi.fn();
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

let overviewCtx: {
  business: Business;
  setBusiness: (b: Business) => void;
  reload: () => Promise<void>;
};

vi.mock('./business-shell', () => ({
  useBusinessContext: () => overviewCtx,
}));

function makeBusiness(role: Business['myRole']): Business {
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
    myRole: role,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  };
}

const messages = {
  ...catalogs.en.common,
  ...catalogs.en.shell,
  errors: catalogs.en.errors,
  business: catalogs.en.business,
};

function renderOverview(role: Business['myRole']) {
  overviewCtx = {
    business: makeBusiness(role),
    setBusiness: () => undefined,
    reload: async () => undefined,
  };
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BusinessOverview />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  loadChecklist.mockReset();
  apiRequest.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('BusinessOverview', () => {
  it('does not load the checklist for STAFF', async () => {
    renderOverview('STAFF');
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: catalogs.en.business.overview.heading }),
      ).toBeInTheDocument();
    });
    expect(loadChecklist).not.toHaveBeenCalled();
    expect(screen.queryByText(catalogs.en.business.overview.checklistHeading)).toBeNull();
  });

  it('renders checklist flags for OWNER', async () => {
    loadChecklist.mockResolvedValue({
      hasLogo: true,
      hasStaff: false,
      hasServiceWithStaff: true,
      allActiveHaveHours: false,
    });
    renderOverview('OWNER');
    await waitFor(() => {
      expect(screen.getByText(catalogs.en.business.overview.itemLogo)).toBeInTheDocument();
    });
    expect(screen.getAllByText(catalogs.en.business.overview.done)).toHaveLength(2);
    expect(screen.getAllByText(catalogs.en.business.overview.todo)).toHaveLength(2);
  });
});
