import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Text } from './text';
import {
  CONTROL_BORDER_WIDTH,
  CONTROL_HEIGHT,
  fontFamilies,
  ICON_SIZE,
  MAX_FONT_SIZE_MULTIPLIER,
  MIN_TOUCH_TARGET,
} from './theme';

export interface TextFieldProps extends TextInputProps {
  label: string;
  /** Hint shown under the input; replaced by `error` when both are set. */
  helperText?: string;
  /** Validation message; puts the field into its error state. */
  error?: string;
  /** Marks the field as required: adds a visual asterisk and announces it to screen readers. */
  required?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

const { colors, spacing, radius } = tokens;

/**
 * Labelled text input with helper/error text. When `secureTextEntry` is set, a trailing icon
 * button toggles password visibility.
 */
export function TextField({
  label,
  helperText,
  error,
  required = false,
  secureTextEntry,
  containerStyle,
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: TextFieldProps): ReactElement {
  const { t } = useTranslation('mobile');
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const hasError = Boolean(error);
  const message = error ?? helperText;

  return (
    <View style={containerStyle}>
      <Text variant="caption" color="text02" style={styles.label}>
        {required ? `${label} *` : label}
      </Text>
      <View
        style={[
          styles.inputRow,
          focused && styles.inputFocused,
          hasError && styles.inputError,
          !editable && styles.inputDisabled,
        ]}
      >
        <TextInput
          accessibilityLabel={required ? `${label}, ${t('ui.required')}` : label}
          accessibilityHint={message}
          accessibilityState={{ disabled: !editable }}
          allowFontScaling
          editable={editable}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          placeholderTextColor={colors.text03}
          secureTextEntry={secureTextEntry && !revealed}
          selectionColor={colors.primary}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t('ui.hidePassword') : t('ui.showPassword')}
            hitSlop={spacing.sm}
            onPress={() => setRevealed((value) => !value)}
            style={styles.toggle}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={ICON_SIZE.md}
              color={colors.text03}
            />
          </Pressable>
        ) : null}
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
  toggle: {
    minWidth: MIN_TOUCH_TARGET - spacing.lg,
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  message: { marginTop: spacing.xs },
});
