'use client';

import { weekdaySchemaValues, type Weekday, type WorkingHoursInterval } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { cn } from '@/lib/utils';

import {
  mapWorkingHoursApiErrors,
  mapWorkingHoursIssues,
  type RowErrorMap,
} from './map-schedule-validation';
import { formatLocalHhMm } from './schedule-format';
import {
  copyDayToTargets,
  emptyWeekDraft,
  intervalAfter,
  intervalsToDraft,
  validateWorkingHoursDraft,
  type DayDraft,
  type IntervalDraft,
} from './working-hours-draft';

type WorkingHoursEditorProps = {
  initialIntervals: WorkingHoursInterval[];
  disabled?: boolean;
  saving?: boolean;
  onSave: (intervals: WorkingHoursInterval[]) => Promise<void>;
};

export function WorkingHoursEditor({
  initialIntervals,
  disabled = false,
  saving = false,
  onSave,
}: WorkingHoursEditorProps) {
  const t = useTranslations('business');
  const locale = useLocale();
  const [days, setDays] = useState<DayDraft[]>(() =>
    initialIntervals.length === 0 ? emptyWeekDraft() : intervalsToDraft(initialIntervals),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowErrorMap>({});
  const [copyOpenFor, setCopyOpenFor] = useState<Weekday | null>(null);
  const [copyTargets, setCopyTargets] = useState<Weekday[]>([]);

  const weekdayLabel = useMemo(
    () =>
      ({
        MONDAY: t('schedule.weekday.monday'),
        TUESDAY: t('schedule.weekday.tuesday'),
        WEDNESDAY: t('schedule.weekday.wednesday'),
        THURSDAY: t('schedule.weekday.thursday'),
        FRIDAY: t('schedule.weekday.friday'),
        SATURDAY: t('schedule.weekday.saturday'),
        SUNDAY: t('schedule.weekday.sunday'),
      }) satisfies Record<Weekday, string>,
    [t],
  );

  function updateDay(weekday: Weekday, updater: (day: DayDraft) => DayDraft): void {
    setDays((prev) => prev.map((day) => (day.weekday === weekday ? updater(day) : day)));
    setFormError(null);
    setRowErrors({});
  }

  function setClosed(weekday: Weekday, closed: boolean): void {
    updateDay(weekday, (day) => ({
      ...day,
      closed,
      intervals: closed
        ? []
        : day.intervals.length > 0
          ? day.intervals
          : [intervalAfter(undefined)],
    }));
  }

  function addInterval(weekday: Weekday): void {
    updateDay(weekday, (day) => {
      if (day.closed || day.intervals.length >= 6) return day;
      const previous = day.intervals[day.intervals.length - 1];
      return {
        ...day,
        intervals: [...day.intervals, intervalAfter(previous)],
      };
    });
  }

  function removeInterval(weekday: Weekday, key: string): void {
    updateDay(weekday, (day) => {
      const next = day.intervals.filter((i) => i.key !== key);
      if (next.length === 0) {
        return { ...day, closed: true, intervals: [] };
      }
      return { ...day, intervals: next };
    });
  }

  function patchInterval(
    weekday: Weekday,
    key: string,
    patch: Partial<Pick<IntervalDraft, 'start' | 'end' | 'untilEndOfDay'>>,
  ): void {
    updateDay(weekday, (day) => ({
      ...day,
      intervals: day.intervals.map((interval) =>
        interval.key === key ? { ...interval, ...patch } : interval,
      ),
    }));
  }

  async function handleSave(): Promise<void> {
    const parsed = validateWorkingHoursDraft(days);
    if (!parsed.success) {
      setFormError(t('schedule.hours.validationError'));
      setRowErrors(
        mapWorkingHoursIssues(days, parsed.error.issues, t('schedule.hours.rowValidationError')),
      );
      return;
    }
    setFormError(null);
    setRowErrors({});
    try {
      await onSave(parsed.data.intervals);
    } catch (err) {
      const apiRows = mapWorkingHoursApiErrors(err, days, t('schedule.hours.rowValidationError'));
      if (apiRows) {
        setFormError(t('schedule.hours.validationError'));
        setRowErrors(apiRows);
        return;
      }
      // Non-validation failures are toasted by the parent; do not rethrow.
    }
  }

  function openCopy(weekday: Weekday): void {
    setCopyOpenFor(weekday);
    setCopyTargets([]);
  }

  function applyCopy(): void {
    if (!copyOpenFor || copyTargets.length === 0) {
      setCopyOpenFor(null);
      return;
    }
    setDays((prev) => copyDayToTargets(prev, copyOpenFor, copyTargets));
    setCopyOpenFor(null);
    setCopyTargets([]);
    setFormError(null);
    setRowErrors({});
  }

  function daySummary(day: DayDraft): string {
    if (day.closed || day.intervals.length === 0) {
      return t('schedule.hours.closed');
    }
    return day.intervals
      .map((interval) => {
        const end = interval.untilEndOfDay ? '24:00' : interval.end;
        return `${formatLocalHhMm(interval.start, locale)}–${formatLocalHhMm(end, locale)}`;
      })
      .join(', ');
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-subtitle font-bold text-foreground">{t('schedule.hours.heading')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('schedule.hours.subtitle')}</p>
      </div>

      <ul className="space-y-3">
        {days.map((day) => (
          <li
            key={day.weekday}
            className="rounded-md border border-border p-3 sm:p-4"
            data-weekday={day.weekday}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{weekdayLabel[day.weekday]}</p>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid={`day-summary-${day.weekday}`}
                >
                  {daySummary(day)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`closed-${day.weekday}`}
                    checked={day.closed}
                    onCheckedChange={(checked) => setClosed(day.weekday, checked)}
                    disabled={disabled || saving}
                  />
                  <Label htmlFor={`closed-${day.weekday}`} className="text-sm">
                    {t('schedule.hours.closed')}
                  </Label>
                </div>
                {!day.closed ? (
                  <Popover
                    open={copyOpenFor === day.weekday}
                    onOpenChange={(open) => {
                      if (open) openCopy(day.weekday);
                      else setCopyOpenFor(null);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || saving}
                      >
                        {t('schedule.hours.copyTo')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        {t('schedule.hours.copyHint')}
                      </p>
                      <div
                        role="group"
                        aria-label={t('schedule.hours.copyGroupLabel')}
                        className="grid gap-1"
                      >
                        {weekdaySchemaValues
                          .filter((w) => w !== day.weekday)
                          .map((target) => {
                            const checked = copyTargets.includes(target);
                            const id = `copy-${day.weekday}-${target}`;
                            return (
                              <label
                                key={target}
                                htmlFor={id}
                                className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-secondary"
                              >
                                <Checkbox
                                  id={id}
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    setCopyTargets((prev) =>
                                      value ? [...prev, target] : prev.filter((w) => w !== target),
                                    );
                                  }}
                                />
                                {weekdayLabel[target]}
                              </label>
                            );
                          })}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mt-2 w-full"
                        disabled={copyTargets.length === 0}
                        onClick={applyCopy}
                      >
                        {t('schedule.hours.copyApply')}
                      </Button>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
            </div>

            {!day.closed ? (
              <div className="mt-3 space-y-3">
                {day.intervals.map((interval, index) => (
                  <IntervalRow
                    key={interval.key}
                    weekdayLabel={weekdayLabel[day.weekday]}
                    intervalIndex={index + 1}
                    interval={interval}
                    error={rowErrors[interval.key]}
                    disabled={disabled || saving}
                    onChange={(patch) => patchInterval(day.weekday, interval.key, patch)}
                    onRemove={() => removeInterval(day.weekday, interval.key)}
                  />
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={disabled || saving || day.intervals.length >= 6}
                  onClick={() => addInterval(day.weekday)}
                >
                  {t('schedule.hours.addInterval')}
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t('schedule.hours.closedHint')}</p>
            )}
          </li>
        ))}
      </ul>

      {formError ? (
        <Alert variant="destructive">
          <AlertTitle>{t('schedule.hours.validationTitle')}</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="button"
        loading={saving}
        disabled={disabled || saving}
        onClick={() => void handleSave()}
      >
        {saving ? t('schedule.hours.saving') : t('schedule.hours.save')}
      </Button>
    </section>
  );
}

type IntervalRowProps = {
  weekdayLabel: string;
  intervalIndex: number;
  interval: IntervalDraft;
  error?: string | undefined;
  disabled: boolean;
  onChange: (patch: Partial<Pick<IntervalDraft, 'start' | 'end' | 'untilEndOfDay'>>) => void;
  onRemove: () => void;
};

function IntervalRow({
  weekdayLabel,
  intervalIndex,
  interval,
  error,
  disabled,
  onChange,
  onRemove,
}: IntervalRowProps) {
  const t = useTranslations('business');
  const locale = useLocale();
  const startId = useId();
  const endId = useId();
  const endOfDayId = useId();
  const errorId = useId();

  const endDisplay = interval.untilEndOfDay ? '24:00' : interval.end;
  const rangeLabel = `${formatLocalHhMm(interval.start, locale)}–${formatLocalHhMm(endDisplay, locale)}`;
  const removeLabel = t('schedule.hours.removeIntervalNamed', {
    day: weekdayLabel,
    range: rangeLabel,
  });

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md bg-secondary/40 p-3 sm:flex-row sm:flex-wrap sm:items-end',
        error && 'ring-1 ring-destructive',
      )}
    >
      <div className="grid gap-1">
        <Label htmlFor={startId} className="text-xs text-muted-foreground">
          {t('schedule.hours.start')}
        </Label>
        <TimeInput
          id={startId}
          value={interval.start}
          onChange={(value) => onChange({ start: value })}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          aria-label={t('schedule.hours.startNamed', {
            day: weekdayLabel,
            n: intervalIndex,
          })}
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor={endId} className="text-xs text-muted-foreground">
          {t('schedule.hours.end')}
        </Label>
        {interval.untilEndOfDay ? (
          <p
            id={endId}
            className="flex h-9 items-center text-sm tabular-nums text-foreground"
            aria-label={t('schedule.hours.endNamed', {
              day: weekdayLabel,
              n: intervalIndex,
            })}
          >
            {formatLocalHhMm('24:00', locale)}
          </p>
        ) : (
          <TimeInput
            id={endId}
            value={interval.end}
            onChange={(value) => onChange({ end: value, untilEndOfDay: false })}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            aria-label={t('schedule.hours.endNamed', {
              day: weekdayLabel,
              n: intervalIndex,
            })}
          />
        )}
      </div>
      <div className="flex items-center gap-2 pb-1">
        <Checkbox
          id={endOfDayId}
          checked={interval.untilEndOfDay}
          onCheckedChange={(checked) => onChange({ untilEndOfDay: Boolean(checked) })}
          disabled={disabled}
        />
        <Label htmlFor={endOfDayId} className="text-sm">
          {t('schedule.hours.untilEndOfDay')}
        </Label>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-label={removeLabel}
        onClick={onRemove}
      >
        {t('schedule.hours.removeInterval')}
      </Button>
      {error ? (
        <p id={errorId} role="alert" className="basis-full text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
