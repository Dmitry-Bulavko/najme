'use client';

import { weekdaySchemaValues, type Weekday, type WorkingHoursInterval } from '@najme/contracts';
import { useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { TimeInput } from '@/components/ui/time-input';
import { cn } from '@/lib/utils';

import {
  copyDayToTargets,
  defaultOpenInterval,
  draftToIntervals,
  emptyWeekDraft,
  intervalsToDraft,
  nextDraftKey,
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
  const [days, setDays] = useState<DayDraft[]>(() =>
    initialIntervals.length === 0 ? emptyWeekDraft() : intervalsToDraft(initialIntervals),
  );
  const [formError, setFormError] = useState<string | null>(null);
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
  }

  function setClosed(weekday: Weekday, closed: boolean): void {
    updateDay(weekday, (day) => ({
      ...day,
      closed,
      intervals: closed ? [] : day.intervals.length > 0 ? day.intervals : [defaultOpenInterval()],
    }));
  }

  function addInterval(weekday: Weekday): void {
    updateDay(weekday, (day) => {
      if (day.closed || day.intervals.length >= 6) return day;
      return {
        ...day,
        intervals: [...day.intervals, { ...defaultOpenInterval(), key: nextDraftKey() }],
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
      return;
    }
    setFormError(null);
    await onSave(parsed.data.intervals);
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
              <p className="text-sm font-bold text-foreground">{weekdayLabel[day.weekday]}</p>
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
                  <DropdownMenu
                    open={copyOpenFor === day.weekday}
                    onOpenChange={(open) => {
                      if (open) openCopy(day.weekday);
                      else setCopyOpenFor(null);
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || saving}
                      >
                        {t('schedule.hours.copyTo')}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 p-2">
                      <p className="mb-2 px-1 text-xs text-muted-foreground">
                        {t('schedule.hours.copyHint')}
                      </p>
                      <div className="grid gap-1">
                        {weekdaySchemaValues
                          .filter((w) => w !== day.weekday)
                          .map((target) => {
                            const checked = copyTargets.includes(target);
                            return (
                              <label
                                key={target}
                                className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-secondary"
                              >
                                <Checkbox
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
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>

            {!day.closed ? (
              <div className="mt-3 space-y-3">
                {day.intervals.map((interval) => (
                  <IntervalRow
                    key={interval.key}
                    interval={interval}
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
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <Button
        type="button"
        loading={saving}
        disabled={disabled || saving}
        onClick={() => void handleSave()}
      >
        {saving ? t('schedule.hours.saving') : t('schedule.hours.save')}
      </Button>

      {/* Expose draft intervals for tests without coupling to internals */}
      <span className="sr-only" data-testid="hours-draft-count">
        {draftToIntervals(days).length}
      </span>
    </section>
  );
}

type IntervalRowProps = {
  interval: IntervalDraft;
  disabled: boolean;
  onChange: (patch: Partial<Pick<IntervalDraft, 'start' | 'end' | 'untilEndOfDay'>>) => void;
  onRemove: () => void;
};

function IntervalRow({ interval, disabled, onChange, onRemove }: IntervalRowProps) {
  const t = useTranslations('business');
  const endOfDayId = useId();

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-md bg-secondary/40 p-3 sm:flex-row sm:flex-wrap sm:items-end',
      )}
    >
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{t('schedule.hours.start')}</Label>
        <TimeInput
          value={interval.start}
          onChange={(value) => onChange({ start: value })}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground">{t('schedule.hours.end')}</Label>
        <TimeInput
          value={interval.untilEndOfDay ? '23:55' : interval.end}
          onChange={(value) => onChange({ end: value, untilEndOfDay: false })}
          disabled={disabled || interval.untilEndOfDay}
        />
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
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
        {t('schedule.hours.removeInterval')}
      </Button>
    </div>
  );
}
