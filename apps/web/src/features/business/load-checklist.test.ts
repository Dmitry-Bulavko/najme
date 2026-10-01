import { afterEach, describe, expect, it, vi } from 'vitest';

import { CHECKLIST_HOURS_CONCURRENCY, loadChecklist, mapWithConcurrency } from './load-checklist';

const apiRequest = vi.fn();

vi.mock('@/lib/api/client', () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

const businessId = '11111111-1111-4111-8111-111111111111';
const staffA = '22222222-2222-4222-8222-222222222222';
const staffB = '33333333-3333-4333-8333-333333333333';
const staffInactive = '44444444-4444-4444-8444-444444444444';
const categoryId = '55555555-5555-4555-8555-555555555555';
const serviceId = '66666666-6666-4666-8666-666666666666';

function business(overrides: Record<string, unknown> = {}) {
  return {
    id: businessId,
    name: 'Salon',
    slug: 'salon',
    categoryId,
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

function staffMember(id: string, active: boolean) {
  return {
    id,
    businessId,
    displayName: id,
    photoUrl: null,
    active,
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  };
}

function service(active: boolean, staffMemberIds: string[]) {
  return {
    id: serviceId,
    businessId,
    name: 'Cut',
    description: null,
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    price: { amount: 1000, currency: 'EUR' },
    minBookingNoticeMinutes: null,
    bookingHorizonDays: null,
    active,
    staffMemberIds,
    customFields: [],
    createdAt: '2026-06-01T10:00:00.000Z',
    updatedAt: '2026-06-01T10:00:00.000Z',
  };
}

afterEach(() => {
  apiRequest.mockReset();
});

describe('mapWithConcurrency', () => {
  it('caps in-flight work', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5, 6];
    await mapWithConcurrency(items, 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return n * 2;
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});

describe('loadChecklist', () => {
  it('uses only active staff for staff/hours and active assignees for services', async () => {
    apiRequest.mockImplementation(async (path: string) => {
      if (path === `/businesses/${businessId}`) {
        return business({ logoUrl: 'https://cdn.example/logo.png' });
      }
      if (path === `/businesses/${businessId}/staff`) {
        return [
          staffMember(staffA, true),
          staffMember(staffB, true),
          staffMember(staffInactive, false),
        ];
      }
      if (path === `/businesses/${businessId}/services`) {
        return [service(true, [staffInactive]), service(false, [staffA])];
      }
      if (path.includes('/working-hours')) {
        return { intervals: [{ weekday: 'MONDAY', start: '09:00', end: '10:00' }] };
      }
      throw new Error(`unexpected ${path}`);
    });

    const state = await loadChecklist(businessId);
    expect(state.hasLogo).toBe(true);
    expect(state.hasStaff).toBe(true);
    expect(state.hasServiceWithStaff).toBe(false);
    expect(state.allActiveHaveHours).toBe(true);
    const hoursCalls = apiRequest.mock.calls.filter(([path]) =>
      String(path).includes('/working-hours'),
    );
    expect(hoursCalls).toHaveLength(2);
    expect(hoursCalls.every(([path]) => !String(path).includes(staffInactive))).toBe(true);
  });

  it('marks service done when an active service has an active assignee', async () => {
    apiRequest.mockImplementation(async (path: string) => {
      if (path === `/businesses/${businessId}`) return business();
      if (path === `/businesses/${businessId}/staff`) return [staffMember(staffA, true)];
      if (path === `/businesses/${businessId}/services`) return [service(true, [staffA])];
      if (path.includes('/working-hours')) return { intervals: [] };
      throw new Error(`unexpected ${path}`);
    });
    const state = await loadChecklist(businessId);
    expect(state.hasServiceWithStaff).toBe(true);
    expect(state.allActiveHaveHours).toBe(false);
  });

  it('exposes the hours concurrency constant', () => {
    expect(CHECKLIST_HOURS_CONCURRENCY).toBe(4);
  });
});
