import {
  formatMinorAsMajor,
  parseMajorToMinor,
  type ContractLocale,
  type Money,
} from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
  const announcedError = useRef<string | null>(null);

  useEffect(() => {
    if (!error || error === announcedError.current) return;
    announcedError.current = error;
    // Android already announces via accessibilityLiveRegion; double-announce only on iOS.
    if (Platform.OS === 'ios') {
      void AccessibilityInfo.announceForAccessibility(error);
    }
  }, [error]);

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
            const raw = draft ?? display;
            const ok = applyDraft(raw);
            if (!ok) return;
            // Keep a typed prefix that does not yet match the formatted amount (e.g. "1"
            // while typing "12.50"). An unexpected blur mid-keystroke must not rewrite the
            // field to "1.00" and commit a truncated price.
            const trimmed = raw.trim();
            if (trimmed.length === 0) {
              setDraft(null);
              return;
            }
            const minor = parseMajorToMinor(trimmed, locale);
            if (minor === null) return;
            const formatted = formatMinorAsMajor(minor, locale);
            if (trimmed === formatted) {
              setDraft(null);
            }
          }}
        />
        <Text variant="caption" color="text03" accessibilityElementsHidden>
          {currency}
        </Text>
      </View>
      {/*
        Stable message slot. On web, role="alert" mount/unmount steals TextInput focus;
        use alert only on native. Live region + announceForAccessibility cover SR updates.
      */}
      <Text
        variant="caption"
        color={hasError ? 'danger' : 'text03'}
        style={[styles.message, !message && styles.messageEmpty]}
        accessibilityRole={hasError && Platform.OS !== 'web' ? 'alert' : undefined}
        accessibilityLiveRegion={hasError ? 'polite' : undefined}
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
