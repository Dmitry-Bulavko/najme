import { businessSchema, type Business } from '@najme/contracts';
import { tokens } from '@najme/ui-tokens';
import { Redirect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Banner, Button } from '@/components/ui';
import { useSession } from '@/features/auth/auth-provider';
import { ApiError, apiRequest } from '@/lib/api/client';

import { writeAppMode, writeLastBusinessId } from './last-business';

type BusinessContextValue = {
  business: Business;
  setBusiness: (update: Business | ((prev: Business) => Business)) => void;
  reload: () => Promise<void>;
};

const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusinessContext(): BusinessContextValue {
  const ctx = useContext(BusinessContext);
  if (!ctx) {
    throw new Error('useBusinessContext must be used under BusinessProvider');
  }
  return ctx;
}

type BusinessProviderProps = {
  businessId: string;
  children: ReactNode;
};

/**
 * Loads `GET /businesses/:id` for the dashboard shell and remembers the id as last-used.
 * Redirects anonymous users to sign-in so they never see a raw API error screen.
 */
export function BusinessProvider({ businessId, children }: BusinessProviderProps) {
  const { t } = useTranslation(['business', 'errors']);
  const session = useSession();
  const [business, setBusinessState] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const setBusiness = useCallback((update: Business | ((prev: Business) => Business)) => {
    setBusinessState((prev) => {
      if (!prev) return prev;
      return typeof update === 'function' ? update(prev) : update;
    });
  }, []);

  const reload = useCallback(async () => {
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    // Anonymous/loading are handled in render (Redirect / spinner); skip the fetch.
    if (session.state !== 'authenticated') {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const raw = await apiRequest<unknown>(`/businesses/${businessId}`);
        const parsed = businessSchema.parse(raw);
        if (!cancelled) {
          setBusinessState(parsed);
          await writeLastBusinessId(parsed.id);
          await writeAppMode('business');
        }
      } catch (err) {
        if (!cancelled) {
          const code = err instanceof ApiError ? err.code : 'INTERNAL_ERROR';
          setError(t(`errors:${code}`, { defaultValue: t('errors:HTTP_ERROR') }));
          setBusinessState(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, nonce, session.state, t]);

  const value = useMemo<BusinessContextValue | null>(() => {
    if (!business) return null;
    return { business, setBusiness, reload };
  }, [business, reload, setBusiness]);

  if (session.state === 'anonymous') {
    return <Redirect href="/sign-in" />;
  }

  if (session.state === 'loading' || loading) {
    return (
      <View style={styles.center} accessibilityLabel={t('business:shell.loading')}>
        <ActivityIndicator color={tokens.colors.primary} />
      </View>
    );
  }

  if (error || !value) {
    return (
      <View style={styles.center}>
        <Banner tone="error" message={error ?? t('errors:HTTP_ERROR')} />
        <Button label={t('business:list.retry')} onPress={() => void reload()} />
      </View>
    );
  }

  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: tokens.spacing.lg,
    padding: tokens.spacing.lg,
    backgroundColor: tokens.colors.background,
  },
});
