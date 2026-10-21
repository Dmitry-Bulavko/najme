export const CANCELLATION_WINDOW_PRESETS = [0, 30, 60, 120, 240, 1440, 2880, 10080] as const;

export const MIN_BOOKING_NOTICE_PRESETS = [0, 15, 30, 60, 120, 240, 480] as const;

export const BOOKING_HORIZON_DAY_PRESETS = [7, 14, 30, 60, 90, 180, 365] as const;

/**
 * Select options: presets plus the current stored value when it is not a preset, so a
 * round-trip save cannot silently rewrite API values.
 */
export function optionsWithCurrentValue(presets: readonly number[], current: number): number[] {
  if (presets.includes(current)) {
    return [...presets];
  }
  return [...presets, current].sort((a, b) => a - b);
}

type DurationMessages = {
  (key: 'settings.durationNone'): string;
  (key: 'settings.durationMinutes', values: { count: number }): string;
  (key: 'settings.durationHours', values: { count: number }): string;
  (key: 'settings.durationDays', values: { count: number }): string;
};

/** Human-readable duration for booking-policy selects (minutes → hours/days when exact). */
export function formatMinutesLabel(minutes: number, t: DurationMessages): string {
  if (minutes === 0) return t('settings.durationNone');
  if (minutes < 60) return t('settings.durationMinutes', { count: minutes });
  if (minutes % 1440 === 0) {
    return t('settings.durationDays', { count: minutes / 1440 });
  }
  if (minutes % 60 === 0) {
    return t('settings.durationHours', { count: minutes / 60 });
  }
  return t('settings.durationMinutes', { count: minutes });
}

/** Human-readable horizon in days. */
export function formatHorizonLabel(days: number, t: DurationMessages): string {
  return t('settings.durationDays', { count: days });
}
