'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useMemo, type ReactNode } from 'react';

import { bindMyBusinessesQueryClient } from '@/features/business/my-businesses-cache';

import { AuthProvider } from './session-context';

/**
 * Sets up TanStack Query (ADR-0003) and the auth session (ADR-0010) for the whole app.
 * Wrapped in a single component so the layout server component only needs one import.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
    [],
  );

  useEffect(() => {
    bindMyBusinessesQueryClient(queryClient);
    return () => bindMyBusinessesQueryClient(null);
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
