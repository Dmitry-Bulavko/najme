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

import { formatIsoDate, parseIsoDate } from './date-time';
import { Text } from './text';
import { CONTROL_BORDER_WIDTH, CONTROL_HEIGHT, fontFamilies } from './theme';

export interface DatePickerProps {
  label: string;
  /** Calendar date as `YYYY-MM-DD`. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/** Native date picker that emits `YYYY-MM-DD`. */
export function DatePicker({
  label,
  value,
  onChange,
  disabled = false,
  error,
  minimumDate,
  maximumDate,
  containerStyle,
  testID,
}: DatePickerProps): ReactElement {
  const { t } = useTranslation('mobile');
  const [open, setOpen] = useState(false);
  const dateValue = parseIsoDate(value) ?? new Date();

  function handleChange(event: DateTimePickerEvent, date?: Date): void {
    if (Platform.OS === 'android') {
      setOpen(false);
    }
    if (event.type === 'dismissed' || !date) {
      return;
    }
    onChange(formatIsoDate(date));
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
            mode="date"
            value={dateValue}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
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
