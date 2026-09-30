import { tokens } from '@najme/ui-tokens';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import { fontFamilies } from './theme';

export type BadgeTone = 'default' | 'secondary' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

const toneStyles = {
  default: { bg: colors.primary, fg: colors.primaryForeground },
  secondary: { bg: colors.secondary, fg: colors.secondaryForeground },
  success: { bg: colors.success, fg: colors.successForeground },
  warning: { bg: colors.warning, fg: colors.warningForeground },
  danger: { bg: colors.danger, fg: colors.dangerForeground },
} as const;

/** Compact status badge. */
export function Badge({
  children,
  tone = 'default',
  accessibilityLabel,
  style,
  testID,
}: BadgeProps): ReactElement {
  const palette = toneStyles[tone];
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.badge, { backgroundColor: palette.bg }, style]}
    >
      {typeof children === 'string' ? (
        <Text variant="caption" numberOfLines={1} style={[styles.label, { color: palette.fg }]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  label: { fontFamily: fontFamilies.bold },
});
