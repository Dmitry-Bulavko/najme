import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { ApiStatusBadge } from '@/features/health/api-status-badge';
import { PlaceholderScreen } from '@/features/placeholder-screen';
import { LanguageSwitcher } from '@/features/locale/language-switcher';

/** Account tab: no auth yet (out of scope, see issue #15), but hosts the language switcher and API status. */
export default function AccountScreen(): ReactElement {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen title={t('screens.account.title')}>
      <LanguageSwitcher />
      <ApiStatusBadge />
    </PlaceholderScreen>
  );
}
