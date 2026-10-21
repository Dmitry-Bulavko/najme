/**
 * Session context for the Expo app (ADR-0010).
 *
 * On launch: read refresh token from SecureStore → POST /auth/refresh → GET /me.
 * Exposes signIn / signUp / signInWithGoogle / signOut. After a successful auth, the app locale
 * follows the account `locale` via `setLocale`.
 */
import {
  authSessionSchema,
  meSchema,
  type LoginRequest,
  type Me,
  type RegisterRequest,
} from '@najme/contracts';
import { isLocale } from '@najme/i18n';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { clearAppMode, clearLastBusinessId } from '@/features/business/last-business';
import { setLocale } from '@/i18n';
import {
  ApiError,
  apiRequest,
  clearSessionTokens,
  persistAuthSession,
  refreshSession,
  TransientAuthError,
  withAuthMutex,
} from '@/lib/api/client';
import { getRefreshToken } from '@/lib/api/token-storage';

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
  signIn: (credentials: LoginRequest) => Promise<void>;
  signUp: (payload: RegisterRequest) => Promise<void>;
  signInWithGoogle: (idToken: string, locale?: RegisterRequest['locale']) => Promise<void>;
  signOut: () => Promise<void>;
  updateMe: (me: Me) => void;
}

type SessionContextValue = Session & SessionActions;

const SessionContext = createContext<SessionContextValue | null>(null);

async function applySessionFromResponse(raw: unknown): Promise<Me> {
  const parsed = authSessionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('HTTP_ERROR', 'Invalid auth session response', 500);
  }
  await persistAuthSession(parsed.data);
  if (isLocale(parsed.data.user.locale)) {
    await setLocale(parsed.data.user.locale);
  }
  return parsed.data.user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ state: 'loading' });

  const updateMe = useCallback((me: Me) => {
    setSession((prev) => (prev.state === 'authenticated' ? { ...prev, me } : prev));
  }, []);

  const signIn = useCallback(async (credentials: LoginRequest) => {
    const raw = await apiRequest<unknown>('/auth/login', { method: 'POST', body: credentials });
    const me = await applySessionFromResponse(raw);
    setSession({ state: 'authenticated', me });
  }, []);

  const signUp = useCallback(async (payload: RegisterRequest) => {
    const raw = await apiRequest<unknown>('/auth/register', { method: 'POST', body: payload });
    const me = await applySessionFromResponse(raw);
    setSession({ state: 'authenticated', me });
  }, []);

  const signInWithGoogle = useCallback(
    async (idToken: string, locale?: RegisterRequest['locale']) => {
      const raw = await apiRequest<unknown>('/auth/google', {
        method: 'POST',
        body: { idToken, ...(locale ? { locale } : {}) },
      });
      const me = await applySessionFromResponse(raw);
      setSession({ state: 'authenticated', me });
    },
    [],
  );

  const signOut = useCallback(async () => {
    // Serialize with refresh so we revoke the newest rotated token and cannot be undone by a
    // late persistAuthSession (#144).
    await withAuthMutex(async () => {
      try {
        const refreshToken = await getRefreshToken();
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: refreshToken ? { refreshToken } : {},
          skipAuthRetry: true,
        });
      } catch {
        // Logout is best-effort; clear local state regardless.
      }
      await clearSessionTokens();
    });
    // Drop mode memory so the next account does not inherit business mode.
    await clearAppMode();
    await clearLastBusinessId();
    setSession({ state: 'anonymous' });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const newToken = await refreshSession();
        if (cancelled) {
          return;
        }
        if (!newToken) {
          setSession({ state: 'anonymous' });
          return;
        }

        const raw = await apiRequest<unknown>('/me');
        if (cancelled) {
          return;
        }
        const parsed = meSchema.safeParse(raw);
        if (!parsed.success) {
          await clearSessionTokens();
          setSession({ state: 'anonymous' });
          return;
        }
        if (isLocale(parsed.data.locale)) {
          await setLocale(parsed.data.locale);
        }
        if (!cancelled) {
          setSession({ state: 'authenticated', me: parsed.data });
        }
      } catch (error) {
        if (error instanceof TransientAuthError) {
          // Signed-out-for-now: keep SecureStore so the next launch / retry can restore (#144).
          if (!cancelled) {
            setSession({ state: 'anonymous' });
          }
          return;
        }
        if (error instanceof ApiError && error.code === 'REFRESH_TOKEN_REUSED') {
          await clearSessionTokens();
        }
        if (!cancelled) {
          setSession({ state: 'anonymous' });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({ ...session, signIn, signUp, signInWithGoogle, signOut, updateMe }),
    [session, signIn, signUp, signInWithGoogle, signOut, updateMe],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Returns the current session state plus auth actions. */
export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used inside <AuthProvider>');
  }
  return ctx;
}
