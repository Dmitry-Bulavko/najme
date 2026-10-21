import {
  businessSchema,
  staffMembersResponseSchema,
  servicesResponseSchema,
  workingHoursResponseSchema,
} from '@najme/contracts';

import { apiRequest } from '@/lib/api/client';

/** Max parallel working-hours GETs while building the setup checklist. */
export const CHECKLIST_HOURS_CONCURRENCY = 4;

export type ChecklistState = {
  hasLogo: boolean;
  hasStaff: boolean;
  hasServiceWithStaff: boolean;
  allActiveHaveHours: boolean;
};

/**
 * Runs `mapper` over `items` with at most `concurrency` in flight (FIFO).
 * Exported for unit tests.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await mapper(items[i]!);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * Setup checklist flags for OWNER/ADMIN overview.
 * Uses only active staff for staff/hours checks; services must be active with an active assignee.
 */
export async function loadChecklist(businessId: string): Promise<ChecklistState> {
  const [businessRaw, staffRaw, servicesRaw] = await Promise.all([
    apiRequest<unknown>(`/businesses/${businessId}`),
    apiRequest<unknown>(`/businesses/${businessId}/staff`),
    apiRequest<unknown>(`/businesses/${businessId}/services`),
  ]);
  const business = businessSchema.parse(businessRaw);
  const staff = staffMembersResponseSchema.parse(staffRaw);
  const services = servicesResponseSchema.parse(servicesRaw);
  const activeStaff = staff.filter((s) => s.active);
  const activeStaffIds = new Set(activeStaff.map((s) => s.id));

  const hours = await mapWithConcurrency(
    activeStaff,
    CHECKLIST_HOURS_CONCURRENCY,
    async (member) => {
      const raw = await apiRequest<unknown>(
        `/businesses/${businessId}/staff/${member.id}/working-hours`,
      );
      return workingHoursResponseSchema.parse(raw);
    },
  );

  return {
    hasLogo: business.logoUrl !== null,
    hasStaff: activeStaff.length > 0,
    hasServiceWithStaff: services.some(
      (s) => s.active && s.staffMemberIds.some((id) => activeStaffIds.has(id)),
    ),
    allActiveHaveHours: activeStaff.length > 0 && hours.every((h) => h.intervals.length > 0),
  };
}
