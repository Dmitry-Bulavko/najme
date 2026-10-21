import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import { CONTROL_HEIGHT, fontFamilies, MIN_TOUCH_TARGET } from './theme';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing, radius } = tokens;

/** Exclusive segmented control for 2–4 options (e.g. day / week views). */
export function SegmentedControl({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
  style,
  testID,
}: SegmentedControlProps): ReactElement {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={[styles.track, style]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            // Visual height is intentionally compact; hitSlop extends the touch area to 44 dp.
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !disabled && !selected && styles.segmentPressed,
            ]}
          >
            <Text
              variant="caption"
              numberOfLines={1}
              style={[styles.label, selected ? styles.labelSelected : undefined]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    minHeight: CONTROL_HEIGHT.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.secondary,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH_TARGET - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
  },
  segmentSelected: { backgroundColor: colors.base01 },
  segmentPressed: { backgroundColor: colors.base04 },
  label: { fontFamily: fontFamilies.bold, color: colors.text02 },
  labelSelected: { color: colors.text01 },
});
