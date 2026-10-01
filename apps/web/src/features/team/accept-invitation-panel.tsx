'use client';

import {
  businessMemberSchema,
  invitationPreviewResponseSchema,
  myBusinessesResponseSchema,
  type InvitationPreviewResponse,
  type MembershipRole,
} from '@najme/contracts';
import { isLocale } from '@najme/i18n';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmailLinkToken } from '@/features/auth/use-email-link-token';
import { useSession } from '@/features/auth/session-context';
import { writeLastBusinessId } from '@/features/business/last-business';
import { useInvalidateMyBusinesses } from '@/features/business/use-my-businesses';
import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';

import { formatInvitationExpiry } from './format-invitation-expiry';
import { clearInviteToken, readInviteToken, writeInviteToken } from './invite-token-storage';

type AcceptStatus =
  | 'loading'
  | 'ready'
  | 'accepting'
  | 'success'
  | 'missing'
  | 'invalid'
  | 'expired'
  | 'mismatch'
  | 'already_member'
  | 'error';

function roleLabel(
  role: MembershipRole,
  t: ReturnType<typeof useTranslations<'business'>>,
): string {
  return t('team.role', { role });
}

/** Resolve the joined business id — accept response has no businessId (#77). */
async function resolveAcceptedBusinessId(
  businessName: string,
  role: MembershipRole,
): Promise<string | null> {
  const raw = await apiRequest<unknown>('/me/businesses');
  const list = myBusinessesResponseSchema.parse(raw);
  const exact = list.find((b) => b.name === businessName && b.role === role);
  if (exact) return exact.businessId;
  const byName = list.find((b) => b.name === businessName);
  return byName?.businessId ?? null;
}

/**
 * Invitation accept flow: strip token from URL, persist across auth, preview, accept.
 * Terminal errors and success clear sessionStorage.
 */
export function AcceptInvitationPanel() {
  const t = useTranslations('business');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const safeLocale = isLocale(locale) ? locale : 'en';
  const router = useRouter();
  const session = useSession();
  const invalidateMyBusinesses = useInvalidateMyBusinesses();
  const urlToken = useEmailLinkToken();

  // null until hydrated from URL / sessionStorage (avoids SSR mismatch).
  const [token, setToken] = useState<string | null>(null);
  const [tokenReady, setTokenReady] = useState(false);
  const [preview, setPreview] = useState<InvitationPreviewResponse | null>(null);
  const [status, setStatus] = useState<AcceptStatus>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [acceptedBusinessId, setAcceptedBusinessId] = useState<string | null>(null);
  const previewStarted = useRef(false);

  // Prefer the URL token (first visit); fall back to sessionStorage after auth redirect.
  useEffect(() => {
    // External store (sessionStorage) — must run after mount so SSR markup matches (#146).
    const nextToken = urlToken ?? readInviteToken();
    if (urlToken) {
      writeInviteToken(urlToken);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate invite token once from URL/storage
    setToken(nextToken);
    setTokenReady(true);
    if (!nextToken) {
      setStatus('missing');
    }
  }, [urlToken]);

  const acceptPath = `/${safeLocale}/invitations/accept`;
  const signInHref = useMemo(() => {
    const next = encodeURIComponent(acceptPath);
    return `/${safeLocale}/sign-in?next=${next}`;
  }, [acceptPath, safeLocale]);
  const signUpHref = useMemo(() => {
    const next = encodeURIComponent(acceptPath);
    return `/${safeLocale}/sign-up?next=${next}`;
  }, [acceptPath, safeLocale]);

  const loadPreview = useCallback(
    async (inviteToken: string) => {
      setStatus('loading');
      setErrorText(null);
      try {
        const raw = await apiRequest<unknown>(
          `/invitations/preview?token=${encodeURIComponent(inviteToken)}`,
        );
        const parsed = invitationPreviewResponseSchema.parse(raw);
        setPreview(parsed);
        setStatus('ready');
      } catch (err) {
        const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
        if (code === 'TOKEN_EXPIRED') {
          clearInviteToken();
          setStatus('expired');
          setErrorText(errorMessage(tErrors, code));
          return;
        }
        if (code === 'TOKEN_INVALID') {
          clearInviteToken();
          setStatus('invalid');
          setErrorText(errorMessage(tErrors, code));
          return;
        }
        setStatus('error');
        setErrorText(errorMessage(tErrors, code));
      }
    },
    [tErrors],
  );

  useEffect(() => {
    if (!tokenReady || !token || previewStarted.current) return;
    previewStarted.current = true;
    void loadPreview(token);
  }, [loadPreview, token, tokenReady]);

  async function onAccept(): Promise<void> {
    if (!token || !preview) return;
    setStatus('accepting');
    try {
      const raw = await apiRequest<unknown>('/invitations/accept', {
        method: 'POST',
        body: { token },
      });
      businessMemberSchema.parse(raw);
      const businessId = await resolveAcceptedBusinessId(preview.businessName, preview.role);
      clearInviteToken();
      invalidateMyBusinesses();
      if (businessId) {
        writeLastBusinessId(businessId);
        setAcceptedBusinessId(businessId);
        setStatus('success');
        router.replace(`/${safeLocale}/business/${businessId}`);
        return;
      }
      setStatus('success');
      router.replace(`/${safeLocale}/business`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
      if (code === 'INVITATION_EMAIL_MISMATCH') {
        setStatus('mismatch');
        setErrorText(errorMessage(tErrors, code));
        return;
      }
      if (code === 'ALREADY_MEMBER') {
        clearInviteToken();
        setStatus('already_member');
        setErrorText(errorMessage(tErrors, code));
        return;
      }
      if (code === 'TOKEN_EXPIRED') {
        clearInviteToken();
        setStatus('expired');
        setErrorText(errorMessage(tErrors, code));
        return;
      }
      if (code === 'TOKEN_INVALID') {
        clearInviteToken();
        setStatus('invalid');
        setErrorText(errorMessage(tErrors, code));
        return;
      }
      toast.error(errorMessage(tErrors, code));
      setStatus('ready');
    }
  }

  async function onSignOut(): Promise<void> {
    await session.signOut();
  }

  if (status === 'missing') {
    return (
      <div className="grid gap-4 text-center">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t('inviteAccept.missingToken')}
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/${safeLocale}`}>{t('inviteAccept.goHome')}</Link>
        </Button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={t('inviteAccept.loading')}>
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-6 w-48" />
        <Skeleton className="mx-auto h-4 w-40" />
      </div>
    );
  }

  if (status === 'expired' || status === 'invalid') {
    return (
      <div className="grid gap-4 text-center" data-testid="invite-accept-terminal">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="block font-bold">
            {status === 'expired' ? t('inviteAccept.expiredTitle') : t('inviteAccept.invalidTitle')}
          </span>
          {errorText ? <span className="mt-1 block">{errorText}</span> : null}
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/${safeLocale}`}>{t('inviteAccept.goHome')}</Link>
        </Button>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="grid gap-4 text-center">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errorText}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            previewStarted.current = false;
            if (token) void loadPreview(token);
          }}
        >
          {t('inviteAccept.retry')}
        </Button>
      </div>
    );
  }

  if (status === 'mismatch') {
    return (
      <div className="grid gap-4 text-center" data-testid="invite-accept-mismatch">
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="block font-bold">{t('inviteAccept.mismatchTitle')}</span>
          <span className="mt-1 block">
            {t('inviteAccept.mismatchBody', {
              email: preview?.emailMasked ?? t('inviteAccept.emailMaskedUnknown'),
            })}
          </span>
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => void onSignOut()}
        >
          {t('inviteAccept.signOut')}
        </Button>
      </div>
    );
  }

  if (status === 'already_member') {
    return (
      <div className="grid gap-4 text-center" data-testid="invite-accept-already-member">
        <p role="status" className="rounded-md bg-success/10 px-3 py-3 text-sm text-text01">
          <span className="block font-bold">{t('inviteAccept.alreadyMemberTitle')}</span>
          <span className="mt-1 block text-muted-foreground">
            {t('inviteAccept.alreadyMemberBody')}
          </span>
        </p>
        {acceptedBusinessId ? (
          <Button asChild className="w-full">
            <Link href={`/${safeLocale}/business/${acceptedBusinessId}`}>
              {t('inviteAccept.goToBusiness')}
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/${safeLocale}/business`}>{t('inviteAccept.goToBusiness')}</Link>
          </Button>
        )}
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="grid gap-4 text-center" data-testid="invite-accept-success">
        <p role="status" className="rounded-md bg-success/10 px-3 py-3 text-sm text-text01">
          <span className="block font-bold">{t('inviteAccept.successTitle')}</span>
          <span className="mt-1 block text-muted-foreground">{t('inviteAccept.successBody')}</span>
        </p>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const signedIn = session.state === 'authenticated';
  const anonymous = session.state === 'anonymous';

  return (
    <div className="grid gap-6 text-center" data-testid="invite-accept-preview">
      <div className="mx-auto size-16 overflow-hidden rounded-full bg-secondary">
        {preview.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote logo hosts vary
          <img
            src={preview.logoUrl}
            alt=""
            width={64}
            height={64}
            className="size-16 object-cover"
          />
        ) : (
          <span className="flex size-16 items-center justify-center text-lg font-bold text-muted-foreground">
            {preview.businessName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      <div>
        <h1 className="text-title font-bold text-foreground">
          {t('inviteAccept.heading', { businessName: preview.businessName })}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('inviteAccept.role', { role: roleLabel(preview.role, t) })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {preview.inviterDisplayName
            ? t('inviteAccept.inviter', { name: preview.inviterDisplayName })
            : t('inviteAccept.inviterUnknown')}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inviteAccept.emailMasked', { email: preview.emailMasked })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('inviteAccept.expiresAt', {
            when: formatInvitationExpiry(preview.expiresAt, safeLocale, 'Europe/Podgorica'),
          })}
        </p>
      </div>

      {anonymous ? (
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t('inviteAccept.signInHint')}</p>
          <Button asChild className="w-full">
            <Link href={signInHref}>{t('inviteAccept.signIn')}</Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={signUpHref}>{t('inviteAccept.signUp')}</Link>
          </Button>
        </div>
      ) : null}

      {signedIn ? (
        <Button
          type="button"
          className="w-full"
          loading={status === 'accepting'}
          onClick={() => void onAccept()}
        >
          {status === 'accepting' ? t('inviteAccept.accepting') : t('inviteAccept.accept')}
        </Button>
      ) : null}

      {session.state === 'loading' ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t('inviteAccept.loading')}
        </p>
      ) : null}
    </div>
  );
}
