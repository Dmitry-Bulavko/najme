import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { formatIsoDate, parseIsoDate } from './date-time';
import { Text } from './text';
import {
  CONTROL_BORDER_WIDTH,
  CONTROL_HEIGHT,
  fontFamilies,
  MAX_FONT_SIZE_MULTIPLIER,
} from './theme';

export interface DatePickerProps {
  label: string;
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

/**
 * Web-export fallback: plain YYYY-MM-DD text field (datetimepicker has no web implementation).
 */
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
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? value;

  return (
    <View style={containerStyle} testID={testID}>
      <Text variant="caption" color="text02" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.inputRow, error && styles.inputError, disabled && styles.inputDisabled]}>
        <TextInput
          accessibilityLabel={label}
          accessibilityState={{ disabled }}
          allowFontScaling
          editable={!disabled}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.text03}
          selectionColor={colors.primary}
          value={display}
          style={styles.input}
          onChangeText={setDraft}
          onFocus={() => setDraft(value)}
          onBlur={() => {
            const parsed = parseIsoDate(draft ?? display);
            if (parsed) {
              if (minimumDate && parsed < minimumDate) {
                setDraft(null);
                return;
              }
              if (maximumDate && parsed > maximumDate) {
                setDraft(null);
                return;
              }
              onChange(formatIsoDate(parsed));
            }
            setDraft(null);
          }}
        />
      </View>
      {error ? (
        <Text variant="caption" color="danger" accessibilityRole="alert" style={styles.message}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  inputRow: {
    minHeight: CONTROL_HEIGHT.md,
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: CONTROL_BORDER_WIDTH,
    borderColor: colors.base04,
    backgroundColor: colors.base01,
    paddingHorizontal: spacing.lg,
  },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  input: {
    fontFamily: fontFamilies.medium,
    fontSize: tokens.typography.scale.bodyLarge.fontSize,
    color: colors.text01,
    paddingVertical: spacing.md,
  },
  message: { marginTop: spacing.xs },
});
