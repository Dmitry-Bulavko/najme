'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { useSession } from './session-context';

const DISMISS_STORAGE_KEY = 'najme.unverified-email-banner.dismissed';

/**
 * Soft email-verification banner (R8 / ADR-0011). Shown when the signed-in user has
 * `emailVerified === false`. Dismissible for the tab session via sessionStorage. Resend
 * feedback uses toasts (no inline status).
 *
 * sessionStorage is read in an effect so the first client render matches the server (#146).
 */
export function UnverifiedEmailBanner() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const [busy, setBusy] = useState(false);
  // null = not yet read from sessionStorage (hide to avoid hydration mismatch).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    // External store (sessionStorage) — must run after mount so SSR markup matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration-safe read (#146)
    setDismissed(sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1');
  }, []);

  if (
    dismissed === null ||
    dismissed ||
    session.state !== 'authenticated' ||
    session.me.emailVerified
  ) {
    return null;
  }

  function onDismiss() {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    setDismissed(true);
  }

  async function onResend() {
    setBusy(true);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: {} });
      toast.success(t('unverifiedBanner.resent'));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(errorMessage(tErrors, error.code));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="status"
      className="border-b border-warning/30 bg-warning/10"
      data-testid="unverified-email-banner"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
        <p className="flex-1 text-sm text-text01">{t('unverifiedBanner.message')}</p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            onClick={() => void onResend()}
          >
            {busy ? t('unverifiedBanner.resending') : t('unverifiedBanner.resend')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            {t('unverifiedBanner.dismiss')}
          </Button>
        </div>
      </div>
    </div>
  );
}
