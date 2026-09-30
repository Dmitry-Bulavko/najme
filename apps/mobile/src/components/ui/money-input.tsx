import {
  formatMinorAsMajor,
  parseMajorToMinor,
  type ContractLocale,
  type Money,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import {
  CONTROL_BORDER_WIDTH,
  CONTROL_HEIGHT,
  fontFamilies,
  MAX_FONT_SIZE_MULTIPLIER,
} from './theme';

export interface MoneyInputProps {
  label: string;
  /** Amount in minor units; `null` clears the field. */
  value: number | null;
  onChange: (minor: number | null) => void;
  currency?: Money['currency'];
  /** UI locale used to detect the decimal separator; defaults to `'en'`. */
  locale?: ContractLocale;
  helperText?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/**
 * Edits a major-unit amount (`,` / `.`) and emits integer minor units.
 * Draft text is kept only while focused; otherwise the controlled value is shown.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  currency = 'EUR',
  locale = 'en',
  helperText,
  error,
  disabled = false,
  containerStyle,
  testID,
}: MoneyInputProps): ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const display = draft ?? (value === null ? '' : formatMinorAsMajor(value));
  const hasError = Boolean(error);
  const message = error ?? helperText;

  function commit(raw: string): void {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      onChange(null);
      return;
    }
    const minor = parseMajorToMinor(trimmed, locale);
    if (minor === null) {
      return;
    }
    onChange(minor);
  }

  return (
    <View style={containerStyle} testID={testID}>
      <Text variant="caption" color="text02" style={styles.label}>
        {label}
      </Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputFocused,
          hasError && styles.inputError,
          disabled && styles.inputDisabled,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={message}
          accessibilityState={{ disabled }}
          allowFontScaling
          editable={!disabled}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.text03}
          selectionColor={colors.primary}
          value={display}
          style={styles.input}
          onChangeText={setDraft}
          onFocus={() => {
            setFocused(true);
            setDraft(value === null ? '' : formatMinorAsMajor(value));
          }}
          onBlur={() => {
            setFocused(false);
            commit(draft ?? display);
            setDraft(null);
          }}
        />
        <Text variant="caption" color="text03" accessibilityElementsHidden>
          {currency}
        </Text>
      </View>
      {message ? (
        <Text
          variant="caption"
          color={hasError ? 'danger' : 'text03'}
          accessibilityRole={hasError ? 'alert' : undefined}
          style={styles.message}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: CONTROL_HEIGHT.md,
    borderRadius: radius.md,
    borderWidth: CONTROL_BORDER_WIDTH,
    borderColor: colors.base04,
    backgroundColor: colors.base01,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  inputDisabled: { backgroundColor: colors.background, opacity: 0.6 },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontFamily: fontFamilies.medium,
    fontSize: tokens.typography.scale.bodyLarge.fontSize,
    color: colors.text01,
  },
  message: { marginTop: spacing.xs },
});
