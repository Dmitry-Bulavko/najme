import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/ui';

/** Discover tab placeholder (real screen lands in M1 — business/service discovery). */
export default function DiscoverScreen(): ReactElement {
  const { t } = useTranslation(['common', 'mobile']);
  return (
    <Screen>
      <EmptyState
        icon="compass-outline"
        message={t('common:screens.discover.body')}
        hint={t('mobile:empty.discover')}
      />
    </Screen>
  );
}
