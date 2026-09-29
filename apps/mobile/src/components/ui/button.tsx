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

import { useTranslation } from 'react-i18next';

import { Text } from './text';
import { CONTROL_BORDER_WIDTH, CONTROL_HEIGHT, fontFamilies } from './theme';

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
  primary: {
    bg: colors.primary,
    pressed: colors.primaryHover,
    fg: colors.primaryForeground,
    pressedFg: colors.primaryForeground,
  },
  secondary: {
    bg: colors.secondary,
    pressed: colors.base04,
    fg: colors.secondaryForeground,
    pressedFg: colors.secondaryForeground,
  },
  // Pressed outline/ghost sit on `secondary` (#EBEFFF), where `primary` text is only 4.05:1 (below
  // AA). `primaryHover` (#4560C4) on `secondary` is 4.92:1, so it is the pressed foreground.
  outline: {
    bg: 'transparent',
    pressed: colors.secondary,
    fg: colors.primary,
    pressedFg: colors.primaryHover,
  },
  ghost: {
    bg: 'transparent',
    pressed: colors.secondary,
    fg: colors.primary,
    pressedFg: colors.primaryHover,
  },
  destructive: {
    bg: colors.danger,
    pressed: colors.danger,
    fg: colors.dangerForeground,
    pressedFg: colors.dangerForeground,
  },
} as const;

const sizeStyles = StyleSheet.create({
  sm: { minHeight: CONTROL_HEIGHT.sm, paddingHorizontal: spacing.lg },
  md: { minHeight: CONTROL_HEIGHT.md, paddingHorizontal: spacing['2xl'] },
  lg: { minHeight: CONTROL_HEIGHT.lg, paddingHorizontal: spacing['3xl'] },
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
  const { t } = useTranslation('mobile');
  const inactive = disabled || loading;
  const palette = variantColors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (loading ? `${label}, ${t('ui.loading')}` : label)}
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
      {({ pressed }) => {
        const foreground = pressed && !inactive ? palette.pressedFg : palette.fg;
        return (
          <View style={styles.content}>
            {loading ? <ActivityIndicator color={foreground} size="small" /> : null}
            <Text variant="body" numberOfLines={1} style={[styles.label, { color: foreground }]}>
              {label}
            </Text>
          </View>
        );
      }}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: CONTROL_BORDER_WIDTH,
    alignSelf: 'flex-start',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { fontFamily: fontFamilies.bold },
});
