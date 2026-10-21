import { describe, expect, it } from '@jest/globals';

import { intervalIndexToRow, mapWorkingHoursIssues } from '../map-schedule-validation';
import { addCalendarDays, formatLocalHhMm, toBusinessLocalDateTime } from '../schedule-format';
import { resolveScheduleHref, staffScheduleHref } from '../schedule-href';
import { buildCreateBody } from '../time-off-body';
import {
  copyDayToTargets,
  draftToIntervals,
  emptyWeekDraft,
  intervalAfter,
  intervalsToDraft,
  validateWorkingHoursDraft,
} from '../working-hours-draft';

describe('resolveScheduleHref', () => {
  it('sends OWNER/ADMIN to the schedule picker', () => {
    expect(resolveScheduleHref('b1', 'OWNER', null)).toBe('/(business)/business/b1/schedule');
    expect(resolveScheduleHref('b1', 'ADMIN', 's1')).toBe('/(business)/business/b1/schedule');
  });

  it('sends STAFF to their linked staff schedule', () => {
    expect(resolveScheduleHref('b1', 'STAFF', 'staff-1')).toBe(
      '/(business)/business/b1/schedule/staff-1',
    );
    expect(resolveScheduleHref('b1', 'STAFF', null)).toBeNull();
  });

  it('builds staff schedule hrefs', () => {
    expect(staffScheduleHref('b1', 's9')).toBe('/(business)/business/b1/schedule/s9');
  });
});

describe('formatLocalHhMm', () => {
  it('uses 12-hour clock for en and 24-hour for me', () => {
    expect(formatLocalHhMm('09:00', 'en')).toMatch(/9:00/);
    expect(formatLocalHhMm('09:00', 'en').toLowerCase()).toMatch(/am|a\.m\./);
    expect(formatLocalHhMm('09:00', 'me')).toMatch(/9:00/);
    expect(formatLocalHhMm('09:00', 'me').toLowerCase()).not.toMatch(/am|pm|a\.m\.|p\.m\./);
    expect(formatLocalHhMm('17:00', 'me')).toMatch(/17:00/);
    expect(formatLocalHhMm('24:00', 'en')).toBe('24:00');
  });
});

describe('addCalendarDays', () => {
  it('returns null for empty or invalid dates', () => {
    expect(addCalendarDays('', 1)).toBeNull();
    expect(addCalendarDays('not-a-date', 1)).toBeNull();
  });

  it('rolls across year end', () => {
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01');
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

  it('seeds a new interval from the previous end', () => {
    const next = intervalAfter({
      key: 'a',
      start: '09:00',
      end: '13:00',
      untilEndOfDay: false,
    });
    expect(next.start).toBe('13:00');
    expect(next.end).toBe('14:00');
  });

  it('maps flat interval indexes back to draft rows', () => {
    const days = intervalsToDraft([
      { weekday: 'MONDAY', start: '09:00', end: '12:00' },
      { weekday: 'WEDNESDAY', start: '10:00', end: '11:00' },
    ]);
    expect(intervalIndexToRow(days, 0)?.weekday).toBe('MONDAY');
    expect(intervalIndexToRow(days, 1)?.weekday).toBe('WEDNESDAY');
    const mapped = mapWorkingHoursIssues(
      days,
      [{ path: ['intervals', 1], message: 'overlap' }],
      'bad',
    );
    const wed = days.find((d) => d.weekday === 'WEDNESDAY')?.intervals[0];
    expect(wed && mapped[wed.key]).toBe('bad');
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

  it('maps all-day across Europe/Podgorica DST start (2026-10-25)', () => {
    expect(
      buildCreateBody({
        allDay: true,
        startDate: '2026-10-25',
        endDate: '2026-10-25',
        startTime: '09:00',
        endTime: '17:00',
        reason: '',
      }),
    ).toEqual({
      start: '2026-10-25T00:00',
      end: '2026-10-26T00:00',
    });
  });

  it('maps all-day across year end (2026-12-31)', () => {
    expect(
      buildCreateBody({
        allDay: true,
        startDate: '2026-12-31',
        endDate: '2026-12-31',
        startTime: '09:00',
        endTime: '17:00',
        reason: '',
      }),
    ).toEqual({
      start: '2026-12-31T00:00',
      end: '2027-01-01T00:00',
    });
  });

  it('maps timed time-off body', () => {
    expect(
      buildCreateBody({
        allDay: false,
        startDate: '2026-09-10',
        endDate: '2026-09-10',
        startTime: '10:00',
        endTime: '12:30',
        reason: 'Dr',
      }),
    ).toEqual({
      start: '2026-09-10T10:00',
      end: '2026-09-10T12:30',
      reason: 'Dr',
    });
  });

  it('returns null when all-day end date is empty', () => {
    expect(
      buildCreateBody({
        allDay: true,
        startDate: '',
        endDate: '',
        startTime: '09:00',
        endTime: '17:00',
        reason: '',
      }),
    ).toBeNull();
  });
});
