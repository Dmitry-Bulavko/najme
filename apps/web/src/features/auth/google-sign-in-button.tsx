'use client';

/**
 * Google Identity Services sign-in button (ADR-0010).
 *
 * Shown only when both:
 *   - GET /auth/providers returns `{ google: true }` (API has GOOGLE_CLIENT_IDS), and
 *   - NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is set (web GIS client),
 * and the session is not already authenticated.
 * Otherwise renders nothing so sign-in/up pages stay clean without #58 credentials.
 *
 * `google.accounts.id.initialize` runs once per page load for a given clientId/locale;
 * latest router/signIn/searchParams/tErrors are read from refs (#146).
 */
import { isLocale } from '@najme/i18n';
import { authProvidersSchema, type AuthSession } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { ApiError, apiRequest } from '@/lib/api/client';
import { errorMessage } from '@/lib/i18n/error-message';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME } from '@/i18n/routing';
import { replaceLocaleInPath, safeNextPath } from './safe-next-path';
import { useSession } from './session-context';

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number;
      locale?: string;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

function setLocaleCookie(localeValue: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${localeValue}; Max-Age=${LOCALE_COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
}

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('GIS script failed')), {
        once: true,
      });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('GIS script failed'));
    document.head.appendChild(script);
  });
}

export function GoogleSignInButton() {
  const t = useTranslations('auth');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useSession();
  const { signIn } = session;
  const buttonHostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? '';

  // Keep latest values for the GIS callback without re-running initialize.
  const signInRef = useRef(signIn);
  const routerRef = useRef(router);
  const searchParamsRef = useRef(searchParams);
  const tErrorsRef = useRef(tErrors);
  const localeRef = useRef(locale);

  useEffect(() => {
    signInRef.current = signIn;
    routerRef.current = router;
    searchParamsRef.current = searchParams;
    tErrorsRef.current = tErrors;
    localeRef.current = locale;
  }, [signIn, router, searchParams, tErrors, locale]);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const raw = await apiRequest<unknown>('/auth/providers', { method: 'GET' });
        const providers = authProvidersSchema.safeParse(raw);
        if (!providers.success || !providers.data.google || cancelled) {
          return;
        }

        await loadGisScript();
        if (cancelled || !window.google?.accounts?.id || !buttonHostRef.current) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: (response) => {
            void (async () => {
              setApiError(null);
              const currentLocale = localeRef.current;
              try {
                const authSession = await apiRequest<AuthSession>('/auth/google', {
                  method: 'POST',
                  body: { idToken: response.credential, locale: currentLocale },
                });
                signInRef.current(authSession.accessToken, authSession.user);

                const pathLocale = isLocale(currentLocale) ? currentLocale : 'en';
                const next = safeNextPath(searchParamsRef.current.get('next'), pathLocale);

                if (
                  isLocale(authSession.user.locale) &&
                  authSession.user.locale !== currentLocale
                ) {
                  setLocaleCookie(authSession.user.locale);
                  routerRef.current.replace(replaceLocaleInPath(next, authSession.user.locale));
                  return;
                }

                routerRef.current.replace(next);
              } catch (error) {
                if (error instanceof ApiError) {
                  setApiError(errorMessage(tErrorsRef.current, error.code));
                } else {
                  setApiError(tErrorsRef.current('HTTP_ERROR'));
                }
              }
            })();
          },
        });

        buttonHostRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonHostRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: buttonHostRef.current.offsetWidth || 320,
          locale,
        });
        setVisible(true);
      } catch {
        // Providers probe or GIS load failed — keep the button hidden.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clientId, locale]);

  if (!clientId || session.state === 'authenticated') {
    return null;
  }

  return (
    <div className={visible ? 'grid gap-3' : 'hidden'} data-testid="google-sign-in">
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">{t('google.or')}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      {apiError ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {apiError}
        </p>
      ) : null}
      {/* GIS paints into this host; keep a minimum height so layout does not jump. */}
      <div ref={buttonHostRef} className="flex min-h-10 w-full justify-center" />
    </div>
  );
}
