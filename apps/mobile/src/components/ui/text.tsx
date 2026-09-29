import { tokens, type ColorToken } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fontFamilies, MAX_FONT_SIZE_MULTIPLIER } from './theme';

export type TextVariant = 'heading' | 'title' | 'body' | 'caption';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Colour token; defaults to primary text (`text01`). */
  color?: ColorToken;
}

const scale = tokens.typography.scale;

const variantStyles = StyleSheet.create({
  heading: {
    fontFamily: fontFamilies.extrabold,
    fontSize: scale.heading.fontSize,
    lineHeight: scale.heading.lineHeight,
  },
  title: {
    fontFamily: fontFamilies.bold,
    fontSize: scale.title.fontSize,
    lineHeight: scale.title.lineHeight,
  },
  body: {
    fontFamily: fontFamilies.medium,
    fontSize: scale.bodyLarge.fontSize,
    lineHeight: scale.bodyLarge.lineHeight,
  },
  caption: {
    fontFamily: fontFamilies.medium,
    fontSize: scale.caption.fontSize,
    lineHeight: scale.caption.lineHeight,
  },
});

/** Typography primitive. Scales with the user's dynamic type setting (capped). */
export function Text({
  variant = 'body',
  color = 'text01',
  style,
  accessibilityRole,
  ...rest
}: TextProps): ReactElement {
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (variant === 'heading' ? 'header' : undefined)}
      allowFontScaling
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      style={[variantStyles[variant], { color: tokens.colors[color] }, style]}
      {...rest}
    />
  );
}
