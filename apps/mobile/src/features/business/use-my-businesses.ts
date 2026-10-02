import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  myBusinessesResponseSchema,
  type MyBusiness,
  type MyBusinessesResponse,
} from '@najme/contracts';

import { useSession } from '@/features/auth/auth-provider';
import { apiRequest } from '@/lib/api/client';

export const MY_BUSINESSES_QUERY_KEY = ['me', 'businesses'] as const;

async function fetchMyBusinesses(): Promise<MyBusinessesResponse> {
  const raw = await apiRequest<unknown>('/me/businesses');
  return myBusinessesResponseSchema.parse(raw);
}

/** Memberships for the signed-in user (`GET /me/businesses`). */
export function useMyBusinesses() {
  const session = useSession();
  const userId = session.state === 'authenticated' ? session.me.id : null;

  return useQuery({
    queryKey: [...MY_BUSINESSES_QUERY_KEY, userId],
    queryFn: fetchMyBusinesses,
    enabled: userId !== null,
  });
}

/** Drop cached memberships (call after create). Stable reference — safe in effect deps. */
export function useInvalidateMyBusinesses() {
  const queryClient = useQueryClient();
  return useCallback(
    () => queryClient.invalidateQueries({ queryKey: MY_BUSINESSES_QUERY_KEY }),
    [queryClient],
  );
}

export type { MyBusiness };
