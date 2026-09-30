import type { Me } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Avatar, Card, Text } from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';

/** Signed-in profile summary: avatar, display name / email, and a verified badge when applicable. */
export function ProfileHeaderCard({ me }: { me: Me }): ReactElement {
  const { t } = useTranslation('account');
  const name = me.displayName?.trim() || me.email;

  return (
    <Card style={styles.card} testID="account-profile-header">
      <Avatar name={name} uri={me.avatarUrl} size={64} />
      <View style={styles.text}>
        <Text variant="title" numberOfLines={1}>
          {name}
        </Text>
        {me.displayName?.trim() ? (
          <Text variant="body" color="text03" numberOfLines={1}>
            {me.email}
          </Text>
        ) : null}
        {me.emailVerified ? (
          <View style={styles.badge} accessibilityRole="text">
            <Text variant="caption" color="primary" style={styles.badgeText}>
              {t('verified')}
            </Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.lg },
  text: { flex: 1, gap: tokens.spacing.xs },
  badge: {
    alignSelf: 'flex-start',
    marginTop: tokens.spacing.xs,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.secondary,
  },
  badgeText: { fontFamily: fontFamilies.bold },
});
