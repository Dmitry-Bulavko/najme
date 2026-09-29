import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

/** Raised surface that groups related content. */
export function Card({ style, ...rest }: ViewProps): ReactElement {
  return <View style={[styles.card, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.base01,
    borderRadius: tokens.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: tokens.colors.base04,
    padding: tokens.spacing.lg,
    gap: tokens.spacing.md,
  },
});
