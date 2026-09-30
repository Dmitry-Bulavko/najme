'use client';

import { meSchema } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest, getAccessToken } from '@/lib/api/client';
import { useSession } from './session-context';
import { useEmailLinkToken } from './use-email-link-token';

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'error';

/**
 * Consumes `?token=` from the verification email link and POSTs `/auth/verify-email`.
 * When a session is present, refreshes `/me` so `emailVerified` flips without a reload.
 */
export function VerifyEmailPanel() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const token = useEmailLinkToken();
  const { updateMe, state: sessionState } = useSession();
  const [status, setStatus] = useState<VerifyStatus>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) {
      return;
    }
    // Wait until the session restore settles so we know whether to refresh /me.
    if (sessionState === 'loading') {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        await apiRequest('/auth/verify-email', { method: 'POST', body: { token } });
        if (getAccessToken()) {
          try {
            const raw = await apiRequest<unknown>('/me');
            const parsed = meSchema.safeParse(raw);
            if (parsed.success) {
              updateMe(parsed.data);
            }
          } catch {
            // Profile refresh is best-effort; verification itself succeeded.
          }
        }
        setStatus('success');
      } catch (error) {
        setStatus('error');
        if (error instanceof ApiError) {
          setErrorMessage(tErrors(error.code as Parameters<typeof tErrors>[0]));
        } else {
          setErrorMessage(tErrors('HTTP_ERROR'));
        }
      }
    })();
  }, [sessionState, tErrors, token, updateMe]);

  async function onResend() {
    if (!getAccessToken()) {
      return;
    }
    setResending(true);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: {} });
      toast.success(t('unverifiedBanner.resent'));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(tErrors(error.code as Parameters<typeof tErrors>[0]));
      } else {
        toast.error(tErrors('HTTP_ERROR'));
      }
    } finally {
      setResending(false);
    }
  }

  if (!token) {
    return (
      <div className="grid gap-4 text-center">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('emailVerification.missingToken')}
        </p>
        <Button asChild variant="secondary" size="md" className="w-full">
          <Link href={`/${locale}`}>{t('emailVerification.goHome')}</Link>
        </Button>
      </div>
    );
  }

  if (status === 'verifying' || status === 'idle') {
    return (
      <p
        role="status"
        data-testid="verify-email-pending"
        className="text-center text-sm text-muted-foreground"
      >
        {t('emailVerification.verifying')}
      </p>
    );
  }

  if (status === 'error') {
    const signedIn = Boolean(getAccessToken());
    return (
      <div className="grid gap-4 text-center" data-testid="verify-email-error">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
        {signedIn ? (
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            loading={resending}
            onClick={() => void onResend()}
          >
            {t('emailVerification.resend')}
          </Button>
        ) : (
          <Button asChild variant="secondary" size="md" className="w-full">
            <Link href={`/${locale}/sign-in`}>{t('emailVerification.resend')}</Link>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-center" data-testid="verify-email-success">
      <p role="status" className="rounded-md bg-success/10 px-3 py-3 text-sm text-text01">
        <span className="block font-bold">{t('emailVerification.successTitle')}</span>
        <span className="mt-1 block text-muted-foreground">
          {t('emailVerification.successBody')}
        </span>
      </p>
      <Button asChild size="md" className="w-full">
        <Link href={`/${locale}`}>{t('emailVerification.goHome')}</Link>
      </Button>
    </div>
  );
}
