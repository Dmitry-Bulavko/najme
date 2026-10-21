import { tokens } from '@najme/ui-tokens';
import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './text';
import { SECTION_LETTER_SPACING } from './theme';

/**
 * Labeled section wrapper used on settings-style screens. Renders a small uppercased header above
 * its children. Shared between the anonymous and authenticated account screens (#148).
 */
export function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <View style={styles.section}>
      <Text variant="caption" color="text03" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.sm },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: SECTION_LETTER_SPACING,
    marginLeft: tokens.spacing.xs,
  },
});
