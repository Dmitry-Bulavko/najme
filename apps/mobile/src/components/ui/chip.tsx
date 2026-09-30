import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import { fontFamilies, MIN_TOUCH_TARGET } from './theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/** Compact selectable chip (filters, tags). */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
  style,
  testID,
}: ChipProps): ReactElement {
  const pressable = Boolean(onPress);

  return (
    <Pressable
      accessibilityRole={pressable ? 'button' : 'text'}
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !pressable}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && pressable && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
        style,
      ]}
    >
      <Text
        variant="caption"
        numberOfLines={1}
        style={[styles.label, selected ? styles.labelSelected : undefined]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    minHeight: MIN_TOUCH_TARGET - spacing.sm,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.base04,
    backgroundColor: colors.base01,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  chipPressed: { backgroundColor: colors.secondary },
  chipDisabled: { opacity: 0.5 },
  label: { fontFamily: fontFamilies.bold, color: colors.text02 },
  labelSelected: { color: colors.primary },
});
