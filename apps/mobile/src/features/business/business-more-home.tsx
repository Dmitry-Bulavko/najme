import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { ListGroup, ListItem, Screen, Section } from '@/components/ui';

import { useBusinessContext } from './business-provider';
import { enterClientMode } from './enter-mode';
import { businessHref } from './last-business';

/**
 * More tab home: profile, settings (OWNER/ADMIN), switch business, client mode.
 */
export function BusinessMoreHome(): ReactElement {
  const { t } = useTranslation('business');
  const router = useRouter();
  const { business } = useBusinessContext();
  const canManage = business.myRole === 'OWNER' || business.myRole === 'ADMIN';
  const base = businessHref(business.id, '/more');

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <Section title={business.name}>
        <ListGroup>
          <ListItem
            icon="storefront-outline"
            title={t('shell.profile')}
            onPress={() => router.push(`${base}/profile`)}
            testID="more-profile"
          />
          {canManage ? (
            <ListItem
              icon="settings-outline"
              title={t('shell.settings')}
              onPress={() => router.push(`${base}/settings`)}
              testID="more-settings"
            />
          ) : null}
          <ListItem
            icon="swap-horizontal-outline"
            title={t('menu.switchBusiness')}
            onPress={() => router.replace('/(business)/pick')}
            testID="more-switch-business"
          />
          <ListItem
            icon="person-outline"
            title={t('shell.clientMode')}
            onPress={() => void enterClientMode(router)}
            testID="more-client-mode"
          />
        </ListGroup>
      </Section>
    </Screen>
  );
}
