'use client';

import { meSchema } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError, apiRequest, getAccessToken } from '@/lib/api/client';
import { useSession } from './session-context';

type VerifyStatus = 'idle' | 'verifying' | 'success' | 'error';

/**
 * Consumes `?token=` from the verification email link and POSTs `/auth/verify-email`.
 * When a session is present, refreshes `/me` so `emailVerified` flips without a reload.
 */
export function VerifyEmailPanel() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const { updateMe, state: sessionState } = useSession();
  const [status, setStatus] = useState<VerifyStatus>(token ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  }, [searchParams, sessionState, tErrors, token, updateMe]);

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
      <p role="status" className="text-center text-sm text-muted-foreground">
        {t('emailVerification.verifying')}
      </p>
    );
  }

  if (status === 'error') {
    return (
      <div className="grid gap-4 text-center">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorMessage}
        </p>
        <Button asChild variant="secondary" size="md" className="w-full">
          <Link href={`/${locale}/sign-in`}>{t('emailVerification.signIn')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 text-center">
      <p role="status" className="rounded-md bg-success/10 px-3 py-3 text-sm text-text01">
        <span className="block font-bold">{t('emailVerification.successTitle')}</span>
        <span className="mt-1 block text-muted-foreground">{t('emailVerification.successBody')}</span>
      </p>
      <Button asChild size="md" className="w-full">
        <Link href={`/${locale}`}>{t('emailVerification.goHome')}</Link>
      </Button>
    </div>
  );
}
