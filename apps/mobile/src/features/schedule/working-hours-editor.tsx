import { weekdaySchemaValues, type Weekday, type WorkingHoursInterval } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Chip, SwitchRow, Text, TimePicker } from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';

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

/** Weekly working-hours editor with Closed, multi-interval, Copy to…, until end of day. */
export function WorkingHoursEditor({
  initialIntervals,
  disabled = false,
  saving = false,
  onSave,
}: WorkingHoursEditorProps): ReactElement {
  const { t, i18n } = useTranslation('business');
  const locale = i18n.language;
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
      }
    }
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
    <View style={styles.section} testID="working-hours-editor">
      <Text variant="title" style={styles.heading}>
        {t('schedule.hours.heading')}
      </Text>
      <Text variant="caption" color="text03">
        {t('schedule.hours.subtitle')}
      </Text>

      {days.map((day) => (
        <View key={day.weekday} style={styles.dayCard} testID={`day-${day.weekday}`}>
          <View style={styles.dayHeader}>
            <View style={styles.dayTitles}>
              <Text variant="body" style={styles.dayName}>
                {weekdayLabel[day.weekday]}
              </Text>
              <Text variant="caption" color="text03" testID={`day-summary-${day.weekday}`}>
                {daySummary(day)}
              </Text>
            </View>
          </View>

          <SwitchRow
            label={t('schedule.hours.closed')}
            value={day.closed}
            onValueChange={(closed) => setClosed(day.weekday, closed)}
            disabled={disabled || saving}
            description={day.closed ? t('schedule.hours.closedHint') : undefined}
            testID={`closed-${day.weekday}`}
          />

          {!day.closed ? (
            <View style={styles.dayBody}>
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
              <View style={styles.dayActions}>
                <Button
                  label={t('schedule.hours.addInterval')}
                  variant="secondary"
                  size="sm"
                  disabled={disabled || saving || day.intervals.length >= 6}
                  onPress={() => addInterval(day.weekday)}
                />
                <Button
                  label={t('schedule.hours.copyTo')}
                  variant="secondary"
                  size="sm"
                  disabled={disabled || saving}
                  onPress={() => {
                    setCopyOpenFor(day.weekday);
                    setCopyTargets([]);
                  }}
                  testID={`copy-open-${day.weekday}`}
                />
              </View>
            </View>
          ) : null}
        </View>
      ))}

      {formError ? <Banner tone="error" message={formError} /> : null}

      <Button
        label={saving ? t('schedule.hours.saving') : t('schedule.hours.save')}
        loading={saving}
        disabled={disabled || saving}
        onPress={() => void handleSave()}
        testID="save-hours"
      />

      <Modal
        visible={copyOpenFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCopyOpenFor(null)}
        accessibilityViewIsModal
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCopyOpenFor(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text variant="title">{t('schedule.hours.copyTo')}</Text>
            <Text variant="caption" color="text03">
              {t('schedule.hours.copyHint')}
            </Text>
            <View
              style={styles.chipRow}
              accessibilityRole="summary"
              accessibilityLabel={t('schedule.hours.copyGroupLabel')}
            >
              {weekdaySchemaValues
                .filter((w) => w !== copyOpenFor)
                .map((target) => {
                  const selected = copyTargets.includes(target);
                  return (
                    <Chip
                      key={target}
                      label={weekdayLabel[target]}
                      selected={selected}
                      onPress={() =>
                        setCopyTargets((prev) =>
                          selected ? prev.filter((w) => w !== target) : [...prev, target],
                        )
                      }
                      testID={`copy-target-${target}`}
                    />
                  );
                })}
            </View>
            <Button
              label={t('schedule.hours.copyApply')}
              disabled={copyTargets.length === 0}
              onPress={applyCopy}
              testID="copy-apply"
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
}: IntervalRowProps): ReactElement {
  const { t, i18n } = useTranslation('business');
  const locale = i18n.language;
  const endDisplay = interval.untilEndOfDay ? '24:00' : interval.end;
  const rangeLabel = `${formatLocalHhMm(interval.start, locale)}–${formatLocalHhMm(endDisplay, locale)}`;

  return (
    <View style={[styles.interval, error ? styles.intervalError : null]}>
      <TimePicker
        label={t('schedule.hours.startNamed', { day: weekdayLabel, n: intervalIndex })}
        value={interval.start}
        onChange={(value) => onChange({ start: value })}
        disabled={disabled}
        error={error}
      />
      {interval.untilEndOfDay ? (
        <View>
          <Text variant="caption" color="text02">
            {t('schedule.hours.endNamed', { day: weekdayLabel, n: intervalIndex })}
          </Text>
          <Text variant="body" style={styles.endOfDayValue}>
            {formatLocalHhMm('24:00', locale)}
          </Text>
        </View>
      ) : (
        <TimePicker
          label={t('schedule.hours.endNamed', { day: weekdayLabel, n: intervalIndex })}
          value={interval.end}
          onChange={(value) => onChange({ end: value, untilEndOfDay: false })}
          disabled={disabled}
        />
      )}
      <SwitchRow
        label={t('schedule.hours.untilEndOfDay')}
        value={interval.untilEndOfDay}
        onValueChange={(untilEndOfDay) => onChange({ untilEndOfDay })}
        disabled={disabled}
        testID={`until-eod-${interval.key}`}
      />
      <Button
        label={t('schedule.hours.removeInterval')}
        variant="ghost"
        size="sm"
        disabled={disabled}
        accessibilityLabel={t('schedule.hours.removeIntervalNamed', {
          day: weekdayLabel,
          range: rangeLabel,
        })}
        onPress={onRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.lg },
  heading: { fontFamily: fontFamilies.bold },
  dayCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    backgroundColor: tokens.colors.base01,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: tokens.spacing.md },
  dayTitles: { flex: 1, gap: tokens.spacing.xs },
  dayName: { fontFamily: fontFamilies.bold },
  dayBody: { gap: tokens.spacing.md },
  dayActions: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
  interval: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
  },
  intervalError: { borderWidth: 1, borderColor: tokens.colors.danger },
  endOfDayValue: { marginTop: tokens.spacing.xs, fontFamily: fontFamilies.medium },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: tokens.spacing.xl,
  },
  modalCard: {
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.base01,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm },
});
