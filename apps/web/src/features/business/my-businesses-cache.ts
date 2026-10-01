import type { QueryClient } from '@tanstack/react-query';

import { MY_BUSINESSES_QUERY_KEY } from './use-my-businesses';

/** Bound by `QueryProvider` so session teardown can drop memberships without useQueryClient. */
let boundClient: QueryClient | null = null;

export function bindMyBusinessesQueryClient(client: QueryClient | null): void {
  boundClient = client;
}

/** Drop cached `GET /me/businesses` results (sign-out / token reuse). */
export function clearMyBusinessesCache(): void {
  boundClient?.removeQueries({ queryKey: MY_BUSINESSES_QUERY_KEY });
}
