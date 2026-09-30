import { tokens } from '@najme/ui-tokens';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState, type ReactElement } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { dateToHhMm, hhMmToDate, snapHhMm, TIME_STEP_MINUTES } from './date-time';
import { Text } from './text';
import { CONTROL_BORDER_WIDTH, CONTROL_HEIGHT, fontFamilies } from './theme';

export interface TimePickerProps {
  label: string;
  /** Wall-clock time as `HH:mm`. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  stepMinutes?: number;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/** Native time picker that emits `HH:mm` snapped to a 5-minute grid. */
export function TimePicker({
  label,
  value,
  onChange,
  disabled = false,
  error,
  stepMinutes = TIME_STEP_MINUTES,
  containerStyle,
  testID,
}: TimePickerProps): ReactElement {
  const { t } = useTranslation('mobile');
  const [open, setOpen] = useState(false);
  const dateValue = hhMmToDate(value) ?? new Date(2000, 0, 1, 9, 0);

  function handleChange(event: DateTimePickerEvent, date?: Date): void {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }
    const raw = dateToHhMm(date);
    onChange(snapHhMm(raw, stepMinutes) ?? raw);
  }

  return (
    <View style={containerStyle} testID={testID}>
      <Text variant="caption" color="text02" style={styles.label}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={value}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.trigger, error && styles.triggerError, disabled && styles.triggerDisabled]}
      >
        <Text variant="body" style={styles.value}>
          {value}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert" style={styles.message}>
          {error}
        </Text>
      ) : null}
      {open ? (
        <>
          <DateTimePicker
            mode="time"
            value={dateValue}
            minuteInterval={stepMinutes as 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('ui.done')}
              onPress={() => setOpen(false)}
              style={styles.done}
            >
              <Text variant="body" color="primary" style={styles.doneText}>
                {t('ui.done')}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  trigger: {
    minHeight: CONTROL_HEIGHT.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: CONTROL_BORDER_WIDTH,
    borderColor: colors.base04,
    backgroundColor: colors.base01,
    paddingHorizontal: spacing.lg,
  },
  triggerError: { borderColor: colors.danger },
  triggerDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  value: { fontFamily: fontFamilies.medium },
  message: { marginTop: spacing.xs },
  done: { alignSelf: 'flex-end', padding: spacing.sm },
  doneText: { fontFamily: fontFamilies.bold },
});
