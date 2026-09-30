import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';
import { MIN_TOUCH_TARGET } from './theme';

export interface SwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const { colors, spacing } = tokens;

/** Settings-style row with a label and an accessible switch. */
export function SwitchRow({
  label,
  value,
  onValueChange,
  description,
  disabled = false,
  style,
  testID,
}: SwitchRowProps): ReactElement {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={description}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && !disabled && styles.pressed, style]}
    >
      <View style={styles.body}>
        <Text variant="body">{label}</Text>
        {description ? (
          <Text variant="caption" color="text03">
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.base04, true: colors.primary }}
        // White thumb on both states; explicitly set so RN Web doesn't bleed the track colour.
        thumbColor={value ? colors.primaryForeground : colors.base01}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
    minHeight: MIN_TOUCH_TARGET + spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.secondary },
  body: { flex: 1, gap: spacing.xs },
});
