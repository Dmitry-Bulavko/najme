import { Ionicons } from '@expo/vector-icons';
import { tokens, type ColorToken } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './text';

export type BannerTone = 'info' | 'success' | 'warning' | 'error';

export interface BannerProps {
  tone?: BannerTone;
  message: string;
  style?: StyleProp<ViewStyle>;
}

const toneConfig: Record<
  BannerTone,
  { color: ColorToken; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  info: { color: 'info', icon: 'information-circle' },
  success: { color: 'success', icon: 'checkmark-circle' },
  warning: { color: 'warning', icon: 'warning' },
  error: { color: 'danger', icon: 'alert-circle' },
};

/** Inline status message: coloured accent bar and icon, neutral text for legibility. */
export function Banner({ tone = 'info', message, style }: BannerProps): ReactElement {
  const { color, icon } = toneConfig[tone];
  const urgent = tone === 'error' || tone === 'warning';

  return (
    <View
      accessibilityRole={urgent ? 'alert' : 'summary'}
      accessibilityLabel={message}
      accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
      style={[styles.banner, { borderLeftColor: tokens.colors[color] }, style]}
    >
      <Ionicons name={icon} size={22} color={tokens.colors[color]} />
      <Text variant="body" style={styles.message}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.base01,
    borderRadius: tokens.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    borderLeftWidth: tokens.spacing.xs,
  },
  message: { flex: 1 },
});
