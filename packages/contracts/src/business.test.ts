import { describe, expect, it } from 'vitest';

import { businessSchema } from './business.js';

describe('businessSchema', () => {
  it('requires nullable rejectionReason', () => {
    const base = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Salon',
      slug: 'salon',
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
      myRole: 'OWNER' as const,
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    };
    expect(() => businessSchema.parse(base)).toThrow();
    expect(
      businessSchema.parse({ ...base, rejectionReason: 'Fix the address.' }).rejectionReason,
    ).toBe('Fix the address.');
    expect(businessSchema.parse({ ...base, rejectionReason: null }).rejectionReason).toBeNull();
  });
});
