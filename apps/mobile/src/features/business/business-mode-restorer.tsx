import { useRouter } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';

import { useSession } from '@/features/auth/auth-provider';
import { enterBusinessMode } from '@/features/business/enter-mode';
import { readAppMode } from '@/features/business/last-business';
import { useMyBusinesses } from '@/features/business/use-my-businesses';

/**
 * On cold start, restore business mode when the user left the app there and still has memberships.
 * Client mode is the default — no redirect.
 */
export function BusinessModeRestorer({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const myBusinesses = useMyBusinesses();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    if (session.state !== 'authenticated') return;
    if (myBusinesses.isLoading) return;
    attempted.current = true;

    void (async () => {
      const mode = await readAppMode();
      if (mode !== 'business') return;
      const list = myBusinesses.data ?? [];
      if (list.length === 0) return;
      await enterBusinessMode(router, list);
    })();
  }, [session.state, myBusinesses.isLoading, myBusinesses.data, router]);

  return children;
}
