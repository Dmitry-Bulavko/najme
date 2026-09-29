import { Ionicons } from '@expo/vector-icons';
import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ICON_BADGE_SIZE, ICON_SIZE } from '@/components/ui/theme';
import { Button, Card, ListGroup, ListItem, Screen, Text } from '@/components/ui';
import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { LanguageSwitcher } from '@/features/locale/language-switcher';

/**
 * Account tab: a sign-in call-to-action (placeholder until the auth task), the language switcher
 * and the API status. In development builds it also links to the UI kit showcase.
 */
export default function AccountScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile']);
  const router = useRouter();

  return (
    <Screen>
      <Card style={styles.signIn}>
        <View style={styles.iconWrap}>
          <Ionicons name="person" size={ICON_SIZE.lg} color={tokens.colors.primary} />
        </View>
        <Text variant="title">{t('mobile:account.signIn.title')}</Text>
        <Text variant="body" color="text03">
          {t('mobile:account.signIn.body')}
        </Text>
        {/* Placeholder: the auth screens are a separate task. */}
        <Button label={t('mobile:account.signIn.action')} fullWidth />
      </Card>

      <Section title={t('mobile:account.language')}>
        <LanguageSwitcher />
      </Section>

      <Section title={t('mobile:account.apiSection')}>
        <ListGroup>
          <ApiStatusBadge />
        </ListGroup>
      </Section>

      {__DEV__ ? (
        <Section title={t('mobile:account.developer')}>
          <ListGroup>
            <ListItem
              icon="color-palette-outline"
              title={t('mobile:account.uiKit')}
              subtitle={t('mobile:account.uiKitHint')}
              onPress={() => router.push('/ui-showcase')}
            />
          </ListGroup>
        </Section>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): ReactElement {
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
  signIn: { gap: tokens.spacing.md },
  iconWrap: {
    width: ICON_BADGE_SIZE.md,
    height: ICON_BADGE_SIZE.md,
    borderRadius: tokens.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.secondary,
  },
  section: { gap: tokens.spacing.sm },
  sectionTitle: { textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: tokens.spacing.xs },
});
