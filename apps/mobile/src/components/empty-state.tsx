import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { ICON_BADGE_SIZE, ICON_SIZE } from '@/components/ui/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Centred illustration-style card used by tab screens whose real content lands in later tasks. */
export function EmptyState({
  icon,
  message,
  hint,
}: {
  icon: IconName;
  message: string;
  hint: string;
}): ReactElement {
  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={ICON_SIZE.xl} color={tokens.colors.primary} />
      </View>
      <Text variant="title" style={styles.centered}>
        {message}
      </Text>
      <Text variant="body" color="text03" style={styles.centered}>
        {hint}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: tokens.spacing['4xl'], gap: tokens.spacing.lg },
  iconWrap: {
    width: ICON_BADGE_SIZE.lg,
    height: ICON_BADGE_SIZE.lg,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
  },
  centered: { textAlign: 'center' },
});
