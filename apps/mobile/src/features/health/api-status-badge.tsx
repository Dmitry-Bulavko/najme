import type { ColorToken } from '@najme/ui-tokens';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { ListItem, Text } from '@/components/ui';
import { fontFamilies } from '@/components/ui/theme';
import { useApiStatus, type ApiStatus } from '@/features/health/use-api-status';

const statusColor: Record<ApiStatus, ColorToken> = {
  checking: 'text03',
  online: 'success',
  unavailable: 'danger',
};

/** Localized API health row, shown on the Account tab (issue #15). */
export function ApiStatusBadge(): ReactElement {
  const { t } = useTranslation();
  const status = useApiStatus();

  const statusText =
    status === 'checking'
      ? t('states.loading')
      : status === 'online'
        ? t('apiStatus.online')
        : t('apiStatus.unavailable');

  return (
    <ListItem
      icon="pulse-outline"
      title={t('apiStatus.label')}
      accessibilityLabel={`${t('apiStatus.label')}: ${statusText}`}
      trailing={
        <Text variant="body" color={statusColor[status]} style={{ fontFamily: fontFamilies.bold }}>
          {statusText}
        </Text>
      }
    />
  );
}
