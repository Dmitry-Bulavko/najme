import { useQuery } from '@tanstack/react-query';
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

/** Memberships for the signed-in user (`GET /me/businesses`). */
export function useMyBusinesses() {
  const session = useSession();
  const enabled = session.state === 'authenticated';

  return useQuery({
    queryKey: MY_BUSINESSES_QUERY_KEY,
    queryFn: fetchMyBusinesses,
    enabled,
  });
}

export type { MyBusiness };
