import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  myBusinessesResponseSchema,
  type MyBusiness,
  type MyBusinessesResponse,
} from '@najme/contracts';

import { apiRequest } from '@/lib/api/client';
import { useSession } from '@/features/auth/session-context';

export const MY_BUSINESSES_QUERY_KEY = ['me', 'businesses'] as const;

async function fetchMyBusinesses(): Promise<MyBusinessesResponse> {
  const raw = await apiRequest<unknown>('/me/businesses');
  return myBusinessesResponseSchema.parse(raw);
}

/** Memberships for the signed-in user (`GET /me/businesses`), keyed by user id. */
export function useMyBusinesses() {
  const session = useSession();
  const userId = session.state === 'authenticated' ? session.me.id : null;

  return useQuery({
    queryKey: [...MY_BUSINESSES_QUERY_KEY, userId],
    queryFn: fetchMyBusinesses,
    enabled: userId !== null,
  });
}

/** Drop cached memberships (call after create and on sign-out). */
export function useInvalidateMyBusinesses() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: MY_BUSINESSES_QUERY_KEY });
}

export type { MyBusiness };
