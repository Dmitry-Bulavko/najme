'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

/**
 * Renders the localized API health status. Takes the already-resolved health check as a prop so the
 * (server-only) fetch in `src/lib/health.ts` stays separate from rendering, keeping this component
 * trivial to unit test with `NextIntlClientProvider`.
 */
export function ApiStatusBadge({ online }: { online: boolean }): ReactElement {
  const t = useTranslations('apiStatus');

  return (
    <p role="status" data-online={online}>
      <span>{t('label')}: </span>
      <strong>{online ? t('online') : t('unavailable')}</strong>
    </p>
  );
}
