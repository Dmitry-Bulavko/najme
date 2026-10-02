import { tokens } from '@najme/ui-tokens';
import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Banner, Button, ListGroup, ListItem, Screen, Text } from '@/components/ui';
import { businessHref, writeLastBusinessId } from '@/features/business/last-business';
import { useMyBusinesses } from '@/features/business/use-my-businesses';

/** Explicit business picker when the user has multiple memberships. */
export default function PickBusinessScreen(): ReactElement {
  const { t } = useTranslation(['business', 'errors']);
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyBusinesses();

  if (isLoading) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <ActivityIndicator
          color={tokens.colors.primary}
          accessibilityLabel={t('business:list.loading')}
        />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Banner tone="error" message={t('business:list.error')} />
        <Button
          label={t('business:list.retry')}
          variant="secondary"
          onPress={() => void refetch()}
        />
      </Screen>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Screen edges={['bottom', 'left', 'right']}>
        <Text variant="body" color="text03">
          {t('business:list.empty')}
        </Text>
        <Button
          label={t('business:list.emptyCta')}
          onPress={() => router.replace('/(business)/new')}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text variant="title">{t('business:list.heading')}</Text>
        <Text variant="body" color="text03">
          {t('business:list.subtitle')}
        </Text>
      </View>
      <ListGroup>
        {data.map((biz) => (
          <ListItem
            key={biz.businessId}
            title={biz.name}
            subtitle={t('business:list.role', { role: biz.role })}
            onPress={() => {
              void (async () => {
                // Provider persists appMode after a successful GET.
                await writeLastBusinessId(biz.businessId);
                router.replace(businessHref(biz.businessId));
              })();
            }}
            testID={`pick-business-${biz.businessId}`}
          />
        ))}
      </ListGroup>
      <Button
        label={t('business:menu.createBusiness')}
        variant="secondary"
        onPress={() => router.replace('/(business)/new')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: tokens.spacing.xs },
});
