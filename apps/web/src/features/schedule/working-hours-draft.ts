import {
  putWorkingHoursRequestSchema,
  weekdaySchemaValues,
  type Weekday,
  type WorkingHoursInterval,
} from '@najme/contracts';

export type IntervalDraft = {
  /** Stable React key for the row. */
  key: string;
  start: string;
  /** Wall-clock end; ignored when `untilEndOfDay` is true. */
  end: string;
  untilEndOfDay: boolean;
};

export type DayDraft = {
  weekday: Weekday;
  closed: boolean;
  intervals: IntervalDraft[];
};

let draftKeySeq = 0;

export function nextDraftKey(): string {
  draftKeySeq += 1;
  return `interval-${draftKeySeq}`;
}

export function emptyWeekDraft(): DayDraft[] {
  return weekdaySchemaValues.map((weekday) => ({
    weekday,
    closed: true,
    intervals: [],
  }));
}

export function intervalsToDraft(intervals: WorkingHoursInterval[]): DayDraft[] {
  const byDay = new Map<Weekday, WorkingHoursInterval[]>();
  for (const weekday of weekdaySchemaValues) {
    byDay.set(weekday, []);
  }
  for (const interval of intervals) {
    const list = byDay.get(interval.weekday);
    if (list) list.push(interval);
  }

  return weekdaySchemaValues.map((weekday) => {
    const dayIntervals = byDay.get(weekday) ?? [];
    if (dayIntervals.length === 0) {
      return { weekday, closed: true, intervals: [] };
    }
    return {
      weekday,
      closed: false,
      intervals: dayIntervals.map((interval) => ({
        key: nextDraftKey(),
        start: interval.start,
        end: interval.end === '24:00' ? '23:55' : interval.end,
        untilEndOfDay: interval.end === '24:00',
      })),
    };
  });
}

export function draftToIntervals(days: DayDraft[]): WorkingHoursInterval[] {
  const intervals: WorkingHoursInterval[] = [];
  for (const day of days) {
    if (day.closed) continue;
    for (const interval of day.intervals) {
      intervals.push({
        weekday: day.weekday,
        start: interval.start,
        end: interval.untilEndOfDay ? '24:00' : interval.end,
      });
    }
  }
  return intervals;
}

/** Validate the draft with the same schema the API uses. */
export function validateWorkingHoursDraft(days: DayDraft[]) {
  return putWorkingHoursRequestSchema.safeParse({ intervals: draftToIntervals(days) });
}

export function defaultOpenInterval(): IntervalDraft {
  return {
    key: nextDraftKey(),
    start: '09:00',
    end: '17:00',
    untilEndOfDay: false,
  };
}

/** Seed a new interval from the previous row's end (fallback to the default open window). */
export function intervalAfter(previous: IntervalDraft | undefined): IntervalDraft {
  if (!previous || previous.untilEndOfDay) {
    return defaultOpenInterval();
  }
  const start = previous.end;
  const startMins = hhMmToMinutes(start);
  if (startMins === null) {
    return defaultOpenInterval();
  }
  const endMins = startMins + 60;
  if (endMins >= 24 * 60) {
    return {
      key: nextDraftKey(),
      start,
      end: '23:55',
      untilEndOfDay: true,
    };
  }
  return {
    key: nextDraftKey(),
    start,
    end: minutesToHhMm(endMins),
    untilEndOfDay: false,
  };
}

function hhMmToMinutes(hhMm: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhMm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToHhMm(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function copyDayToTargets(
  days: DayDraft[],
  sourceWeekday: Weekday,
  targets: readonly Weekday[],
): DayDraft[] {
  const source = days.find((d) => d.weekday === sourceWeekday);
  if (!source) return days;
  const targetSet = new Set(targets);
  return days.map((day) => {
    if (!targetSet.has(day.weekday) || day.weekday === sourceWeekday) {
      return day;
    }
    return {
      weekday: day.weekday,
      closed: source.closed,
      intervals: source.intervals.map((interval) => ({
        ...interval,
        key: nextDraftKey(),
      })),
    };
  });
}
