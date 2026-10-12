import {
  formatMinorAsMajor,
  parseMajorToMinor,
  type ContractLocale,
  type Money,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
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
  /**
   * Fired when draft validity changes. An invalid non-empty draft calls `onChange(null)` and
   * `onDraftInvalidChange(true)` so the form can block submit with a price-invalid error
   * instead of silently keeping a stale partial amount.
   */
  onDraftInvalidChange?: (invalid: boolean) => void;
  currency?: Money['currency'];
  /**
   * UI locale used to detect the decimal separator. Defaults to the active i18next language.
   * Provide explicitly in tests or when rendering outside an I18nextProvider.
   */
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
 * Valid drafts commit on every change. Invalid non-empty drafts stay visible, clear the committed
 * value (`onChange(null)`), and signal `onDraftInvalidChange(true)` so submit cannot save a stale
 * partial amount. The decimal separator follows the active i18next language unless overridden.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  onDraftInvalidChange,
  currency = 'EUR',
  locale: localeProp,
  helperText,
  error,
  disabled = false,
  containerStyle,
  testID,
}: MoneyInputProps): ReactElement {
  // i18n.language is the active locale; map unknown values to 'en' for safety.
  const { i18n } = useTranslation();
  const lang = i18n.language;
  const uiLocale: ContractLocale =
    lang === 'en' || lang === 'me' || lang === 'ru' || lang === 'tr' ? lang : 'en';
  const locale = localeProp ?? uiLocale;
  const [draft, setDraft] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const display = draft ?? (value === null ? '' : formatMinorAsMajor(value, locale));
  const hasError = Boolean(error);
  const message = error ?? helperText;

  function applyDraft(raw: string): boolean {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      onChange(null);
      onDraftInvalidChange?.(false);
      return true;
    }
    const minor = parseMajorToMinor(trimmed, locale);
    if (minor === null) {
      onChange(null);
      onDraftInvalidChange?.(true);
      return false;
    }
    onChange(minor);
    onDraftInvalidChange?.(false);
    return true;
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
          onChangeText={(raw) => {
            setDraft(raw);
            applyDraft(raw);
          }}
          onFocus={() => {
            setFocused(true);
            // Keep an existing draft (e.g. invalid after a blocked submit) so retyping
            // does not reset mid-edit when the parent re-renders.
            setDraft((prev) => prev ?? (value === null ? '' : formatMinorAsMajor(value, locale)));
          }}
          onBlur={() => {
            setFocused(false);
            // Valid drafts drop back to the controlled formatted value; invalid drafts stay visible.
            if (applyDraft(draft ?? display)) {
              setDraft(null);
            }
          }}
        />
        <Text variant="caption" color="text03" accessibilityElementsHidden>
          {currency}
        </Text>
      </View>
      {/*
        Always mount the message slot (no accessibilityRole="alert"): mounting/unmounting an
        alert on web steals focus from the TextInput when validation errors appear or clear
        mid-typing after a blocked Save.
      */}
      <Text
        variant="caption"
        color={hasError ? 'danger' : 'text03'}
        style={[styles.message, !message && styles.messageEmpty]}
        accessibilityElementsHidden={!message}
        importantForAccessibility={message ? 'yes' : 'no-hide-descendants'}
      >
        {message ?? ' '}
      </Text>
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
  messageEmpty: { opacity: 0 },
});
