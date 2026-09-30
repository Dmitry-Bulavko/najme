'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest } from '@/lib/api/client';
import { useSession } from './session-context';

/**
 * Soft email-verification banner (R8 / ADR-0011). Shown when the signed-in user has
 * `emailVerified === false`. Resend calls authenticated POST /auth/verify-email/resend.
 */
export function UnverifiedEmailBanner() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<'resent' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (session.state !== 'authenticated' || session.me.emailVerified) {
    return null;
  }

  async function onResend() {
    setBusy(true);
    setFeedback(null);
    setErrorMessage(null);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: {} });
      setFeedback('resent');
    } catch (error) {
      setFeedback('error');
      if (error instanceof ApiError) {
        setErrorMessage(tErrors(error.code as Parameters<typeof tErrors>[0]));
      } else {
        setErrorMessage(tErrors('HTTP_ERROR'));
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
          {feedback === 'resent' ? (
            <span className="text-xs font-medium text-success">{t('unverifiedBanner.resent')}</span>
          ) : null}
          {feedback === 'error' && errorMessage ? (
            <span role="alert" className="text-xs font-medium text-destructive">
              {errorMessage}
            </span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={busy}
            onClick={() => void onResend()}
          >
            {busy ? t('unverifiedBanner.resending') : t('unverifiedBanner.resend')}
          </Button>
        </div>
      </div>
    </div>
  );
}
