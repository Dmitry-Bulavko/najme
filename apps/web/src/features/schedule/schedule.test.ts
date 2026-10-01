import { describe, expect, it } from 'vitest';

import { isSchedulePathActive, resolveScheduleHref, staffScheduleHref } from './schedule-href';
import { addCalendarDays, toBusinessLocalDateTime } from './schedule-format';
import { buildCreateBody } from './time-off-section';
import {
  copyDayToTargets,
  draftToIntervals,
  emptyWeekDraft,
  intervalsToDraft,
  validateWorkingHoursDraft,
} from './working-hours-draft';

describe('resolveScheduleHref', () => {
  it('sends OWNER/ADMIN to the schedule picker', () => {
    expect(resolveScheduleHref('en', 'b1', 'OWNER', null)).toBe('/en/business/b1/schedule');
    expect(resolveScheduleHref('me', 'b1', 'ADMIN', 's1')).toBe('/me/business/b1/schedule');
  });

  it('sends STAFF to their linked staff schedule', () => {
    expect(resolveScheduleHref('en', 'b1', 'STAFF', 'staff-1')).toBe(
      '/en/business/b1/staff/staff-1/schedule',
    );
    expect(resolveScheduleHref('en', 'b1', 'STAFF', null)).toBeNull();
  });

  it('builds staff schedule hrefs', () => {
    expect(staffScheduleHref('ru', 'b1', 's9')).toBe('/ru/business/b1/staff/s9/schedule');
  });

  it('marks staff schedule paths active for OWNER', () => {
    expect(
      isSchedulePathActive('/en/business/b1/staff/s1/schedule', 'en', 'b1', 'OWNER', null),
    ).toBe(true);
    expect(isSchedulePathActive('/en/business/b1/schedule', 'en', 'b1', 'OWNER', null)).toBe(true);
  });
});

describe('working-hours-draft', () => {
  it('maps empty response to a closed week', () => {
    const days = emptyWeekDraft();
    expect(days).toHaveLength(7);
    expect(days.every((d) => d.closed && d.intervals.length === 0)).toBe(true);
    expect(draftToIntervals(days)).toEqual([]);
  });

  it('round-trips 24:00 via untilEndOfDay', () => {
    const days = intervalsToDraft([{ weekday: 'MONDAY', start: '09:00', end: '24:00' }]);
    const monday = days.find((d) => d.weekday === 'MONDAY');
    expect(monday?.closed).toBe(false);
    expect(monday?.intervals[0]?.untilEndOfDay).toBe(true);
    expect(draftToIntervals(days)).toEqual([{ weekday: 'MONDAY', start: '09:00', end: '24:00' }]);
  });

  it('rejects overlapping intervals using the contracts schema', () => {
    const days = intervalsToDraft([
      { weekday: 'MONDAY', start: '09:00', end: '12:00' },
      { weekday: 'MONDAY', start: '11:00', end: '14:00' },
    ]);
    expect(validateWorkingHoursDraft(days).success).toBe(false);
  });

  it('allows touching intervals', () => {
    const days = intervalsToDraft([
      { weekday: 'MONDAY', start: '09:00', end: '12:00' },
      { weekday: 'MONDAY', start: '12:00', end: '14:00' },
    ]);
    expect(validateWorkingHoursDraft(days).success).toBe(true);
  });

  it('copies a day onto selected targets', () => {
    let days = intervalsToDraft([{ weekday: 'MONDAY', start: '10:00', end: '18:00' }]);
    days = copyDayToTargets(days, 'MONDAY', ['WEDNESDAY', 'FRIDAY']);
    expect(draftToIntervals(days)).toEqual([
      { weekday: 'MONDAY', start: '10:00', end: '18:00' },
      { weekday: 'WEDNESDAY', start: '10:00', end: '18:00' },
      { weekday: 'FRIDAY', start: '10:00', end: '18:00' },
    ]);
  });
});

describe('time-off body builder', () => {
  it('maps all-day to next-day 00:00 (not T24:00)', () => {
    expect(
      buildCreateBody({
        allDay: true,
        startDate: '2026-07-01',
        endDate: '2026-07-01',
        startTime: '09:00',
        endTime: '17:00',
        reason: 'Vacation',
      }),
    ).toEqual({
      start: '2026-07-01T00:00',
      end: '2026-07-02T00:00',
      reason: 'Vacation',
    });
  });

  it('maps multi-day all-day end exclusively', () => {
    expect(addCalendarDays('2026-07-01', 1)).toBe('2026-07-02');
    expect(toBusinessLocalDateTime('2026-07-03', '00:00')).toBe('2026-07-03T00:00');
    expect(
      buildCreateBody({
        allDay: true,
        startDate: '2026-07-01',
        endDate: '2026-07-03',
        startTime: '09:00',
        endTime: '17:00',
        reason: '',
      }),
    ).toEqual({
      start: '2026-07-01T00:00',
      end: '2026-07-04T00:00',
    });
  });
});
