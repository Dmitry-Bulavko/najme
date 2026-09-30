import { z } from 'zod';

import {
  TIME_STEP_MINUTES,
  hhMmEndToMinutes,
  isValidIntervalEnd,
  isValidIntervalStart,
  minutesToHhMmEnd,
  weekdaySchemaValues,
} from './time.js';

export const weekdaySchema = z.enum(weekdaySchemaValues);
export type Weekday = z.infer<typeof weekdaySchema>;

const startTimeSchema = z.string().refine((v) => isValidIntervalStart(v, TIME_STEP_MINUTES), {
  message: 'start must be HH:mm on a 5-minute step',
});

const endTimeSchema = z.string().refine((v) => isValidIntervalEnd(v, TIME_STEP_MINUTES), {
  message: 'end must be HH:mm on a 5-minute step or 24:00',
});

export const workingHoursIntervalSchema = z
  .object({
    weekday: weekdaySchema,
    start: startTimeSchema,
    end: endTimeSchema,
  })
  .superRefine((interval, ctx) => {
    const start = hhMmEndToMinutes(interval.start);
    const end = hhMmEndToMinutes(interval.end);
    if (start === null || end === null) {
      return;
    }
    if (end <= start) {
      ctx.addIssue({
        code: 'custom',
        message: 'end must be after start (no overnight shifts)',
        path: ['end'],
      });
    }
  });

export type WorkingHoursInterval = z.infer<typeof workingHoursIntervalSchema>;

export const putWorkingHoursRequestSchema = z
  .object({
    intervals: z.array(workingHoursIntervalSchema).max(42),
  })
  .superRefine((body, ctx) => {
    const byDay = new Map<string, Array<{ start: number; end: number; index: number }>>();
    body.intervals.forEach((interval, index) => {
      const start = hhMmEndToMinutes(interval.start);
      const end = hhMmEndToMinutes(interval.end);
      if (start === null || end === null) {
        return;
      }
      const list = byDay.get(interval.weekday) ?? [];
      list.push({ start, end, index });
      byDay.set(interval.weekday, list);
    });

    for (const [weekday, list] of byDay) {
      if (list.length > 6) {
        ctx.addIssue({
          code: 'custom',
          message: `at most 6 intervals per weekday (${weekday})`,
          path: ['intervals'],
        });
      }
      const sorted = [...list].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = sorted[i - 1]!;
        const cur = sorted[i]!;
        if (cur.start < prev.end) {
          ctx.addIssue({
            code: 'custom',
            message: `overlapping intervals on ${weekday}`,
            path: ['intervals', cur.index],
          });
        }
      }
    }
  });

export type PutWorkingHoursRequest = z.infer<typeof putWorkingHoursRequestSchema>;

export const workingHoursResponseSchema = z.object({
  intervals: z.array(
    z.object({
      weekday: weekdaySchema,
      start: z.string(),
      end: z.string(),
    }),
  ),
});

export type WorkingHoursResponse = z.infer<typeof workingHoursResponseSchema>;

/** Business-local wall clock without offset: `YYYY-MM-DDTHH:mm`. */
export const businessLocalDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/, 'must be YYYY-MM-DDTHH:mm');

export const createTimeOffRequestSchema = z
  .object({
    start: businessLocalDateTimeSchema,
    end: businessLocalDateTimeSchema,
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.end <= body.start) {
      ctx.addIssue({ code: 'custom', message: 'end must be after start', path: ['end'] });
    }
  });

export type CreateTimeOffRequest = z.infer<typeof createTimeOffRequestSchema>;

export const timeOffSchema = z.object({
  id: z.string().uuid(),
  staffMemberId: z.string().uuid(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().nullable(),
  conflictingBookings: z.array(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TimeOff = z.infer<typeof timeOffSchema>;

export const timeOffListResponseSchema = z.array(timeOffSchema);
export type TimeOffListResponse = z.infer<typeof timeOffListResponseSchema>;

export const listTimeOffQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type ListTimeOffQuery = z.infer<typeof listTimeOffQuerySchema>;

export { minutesToHhMmEnd };
