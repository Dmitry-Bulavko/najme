'use client';

/**
 * Session context and provider (ADR-0010).
 *
 * On mount AuthProvider calls POST /auth/refresh to restore the access token from the httpOnly
 * najme_rt cookie, then GET /me to hydrate the user profile. Exposes useSession() with states:
 *   loading    — initial restore in progress
 *   anonymous  — no valid refresh token / session
 *   authenticated(me) — signed in
 */
import { type Me, meSchema } from '@najme/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';

import {
  apiRequest,
  refreshSession,
  setAccessToken,
  setRefreshTokenReusedHandler,
} from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LoadingSession {
  state: 'loading';
}

interface AnonymousSession {
  state: 'anonymous';
}

interface AuthenticatedSession {
  state: 'authenticated';
  me: Me;
}

export type Session = LoadingSession | AnonymousSession | AuthenticatedSession;

interface SessionActions {
  signIn: (accessToken: string, me: Me) => void;
  signOut: () => Promise<void>;
  updateMe: (me: Me) => void;
}

type SessionContextValue = Session & SessionActions;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const SessionContext = createContext<SessionContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: 'loading' });
  const hasMounted = useRef(false);
  const locale = useLocale();
  const router = useRouter();
  const tErrors = useTranslations('errors');

  const signIn = useCallback((accessToken: string, me: Me) => {
    setAccessToken(accessToken);
    setSession({ state: 'authenticated', me });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      // Logout is best-effort; clear local state regardless.
    }
    setAccessToken(null);
    setSession({ state: 'anonymous' });
  }, []);

  const updateMe = useCallback((me: Me) => {
    setSession((prev) => (prev.state === 'authenticated' ? { ...prev, me } : prev));
  }, []);

  // Refresh-token reuse: clear session, notify, and send the user to sign-in (ADR-0010).
  useEffect(() => {
    setRefreshTokenReusedHandler(() => {
      setAccessToken(null);
      setSession({ state: 'anonymous' });
      toast.error(tErrors('REFRESH_TOKEN_REUSED'));
      router.replace(`/${locale}/sign-in`);
    });
    return () => setRefreshTokenReusedHandler(null);
  }, [locale, router, tErrors]);

  useEffect(() => {
    if (hasMounted.current) {
      return;
    }
    hasMounted.current = true;

    void (async () => {
      const becomeAnonymous = () => {
        setAccessToken(null);
        setSession({ state: 'anonymous' });
      };

      try {
        // Restore access token from the httpOnly cookie via refresh.
        const newToken = await refreshSession();
        if (!newToken) {
          becomeAnonymous();
          return;
        }

        // Hydrate the user profile.
        const raw = await apiRequest<unknown>('/me');
        const parsed = meSchema.safeParse(raw);
        if (!parsed.success) {
          becomeAnonymous();
          return;
        }
        setSession({ state: 'authenticated', me: parsed.data });
      } catch {
        // Reuse handler may already have cleared/toasted/redirected; always drop the token.
        becomeAnonymous();
      }
    })();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...session, signIn, signOut, updateMe }),
    [session, signIn, signOut, updateMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Returns the current session state plus signIn / signOut / updateMe actions. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <AuthProvider>');
  }
  return ctx;
}
