import type { CreateTimeOffRequest } from '@najme/contracts';

import { addCalendarDays, toBusinessLocalDateTime } from './schedule-format';

export type TimeOffFormValues = {
  allDay: boolean;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

/** Map form values to the API body (all-day → next-day 00:00, never T24:00). */
export function buildCreateBody(values: TimeOffFormValues): CreateTimeOffRequest | null {
  const reason = values.reason.trim();
  if (values.allDay) {
    const endDate = addCalendarDays(values.endDate, 1);
    if (!endDate) return null;
    return {
      start: toBusinessLocalDateTime(values.startDate, '00:00'),
      end: toBusinessLocalDateTime(endDate, '00:00'),
      ...(reason ? { reason } : {}),
    };
  }
  return {
    start: toBusinessLocalDateTime(values.startDate, values.startTime),
    end: toBusinessLocalDateTime(values.endDate, values.endTime),
    ...(reason ? { reason } : {}),
  };
}

/** Two years back so past time-off still appears in the broad list. */
export function pastFromIso(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString();
}
