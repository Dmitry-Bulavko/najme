import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Text } from './text';
import { fontFamilies, MIN_TOUCH_TARGET } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const { colors, spacing, radius } = tokens;

const variantColors = {
  primary: { bg: colors.primary, pressed: colors.primaryHover, fg: colors.primaryForeground },
  secondary: { bg: colors.secondary, pressed: colors.base04, fg: colors.secondaryForeground },
  outline: { bg: 'transparent', pressed: colors.secondary, fg: colors.primary },
  ghost: { bg: 'transparent', pressed: colors.secondary, fg: colors.primary },
  destructive: { bg: colors.danger, pressed: colors.danger, fg: colors.dangerForeground },
} as const;

const sizeStyles = StyleSheet.create({
  sm: { minHeight: MIN_TOUCH_TARGET, paddingHorizontal: spacing.lg },
  md: { minHeight: 48, paddingHorizontal: spacing['2xl'] },
  lg: { minHeight: 56, paddingHorizontal: spacing['3xl'] },
});

/**
 * Button primitive with five variants, three sizes, a loading spinner and pressed feedback.
 * While `loading` or `disabled`, presses are ignored and the state is exposed to assistive tech.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  onPress,
  accessibilityLabel,
  ...rest
}: ButtonProps): ReactElement {
  const inactive = disabled || loading;
  const palette = variantColors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        {
          backgroundColor: pressed && !inactive ? palette.pressed : palette.bg,
          borderColor: variant === 'outline' ? colors.primary : 'transparent',
          opacity: disabled ? 0.5 : pressed && variant === 'destructive' ? 0.85 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      <View style={styles.content}>
        {loading ? <ActivityIndicator color={palette.fg} size="small" /> : null}
        <Text variant="body" numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fontFamilies.bold },
});
