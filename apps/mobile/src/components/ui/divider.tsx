import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

/** Hairline separator; hidden from assistive technology. */
export function Divider({ style, ...rest }: ViewProps): ReactElement {
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.divider, style]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: tokens.colors.base04 },
});
