import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { ICON_BADGE_SIZE, ICON_SIZE } from '@/components/ui/theme';

/**
 * Sign-in call-to-action card used on Bookings and Account when the session is anonymous.
 */
export function SignInCta({ title, body }: { title: string; body: string }): ReactElement {
  const { t } = useTranslation(['mobile', 'auth']);
  const router = useRouter();

  return (
    <Card style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="person" size={ICON_SIZE.lg} color={tokens.colors.primary} />
      </View>
      <Text variant="title">{title}</Text>
      <Text variant="body" color="text03">
        {body}
      </Text>
      <Button
        label={t('mobile:account.signIn.action')}
        fullWidth
        onPress={() => router.push('/sign-in')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: tokens.spacing.md },
  iconWrap: {
    width: ICON_BADGE_SIZE.md,
    height: ICON_BADGE_SIZE.md,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
  },
});
