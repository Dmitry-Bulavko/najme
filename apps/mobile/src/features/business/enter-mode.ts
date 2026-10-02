import type { Href } from 'expo-router';

import {
  businessHref,
  writeLastBusinessId,
  readLastBusinessId,
  writeAppMode,
} from './last-business';
import type { MyBusiness } from './use-my-businesses';

type ModeRouter = {
  replace: (href: Href) => void;
  push: (href: Href) => void;
};

/**
 * Enter business mode: pick last/only/first membership and navigate with `replace`.
 * Does not write `appMode` before a business exists — `BusinessProvider` persists mode after a
 * successful `GET /businesses/:id`. Create path leaves mode unset until that load.
 */
export async function enterBusinessMode(
  router: ModeRouter,
  businesses: readonly MyBusiness[],
  options: { forcePick?: boolean; createPath?: Href } = {},
): Promise<void> {
  if (businesses.length === 0) {
    router.replace(options.createPath ?? '/(business)/new');
    return;
  }

  if (options.forcePick) {
    router.replace('/(business)/pick');
    return;
  }

  if (businesses.length === 1) {
    const only = businesses[0];
    if (!only) return;
    await writeLastBusinessId(only.businessId);
    router.replace(businessHref(only.businessId));
    return;
  }

  const last = await readLastBusinessId();
  const match = last ? businesses.find((b) => b.businessId === last) : undefined;
  if (match) {
    await writeLastBusinessId(match.businessId);
    router.replace(businessHref(match.businessId));
    return;
  }

  router.replace('/(business)/pick');
}

/** Leave business mode UI (keeps lastBusinessId, like web client mode). */
export async function enterClientMode(router: Pick<ModeRouter, 'replace'>): Promise<void> {
  await writeAppMode('client');
  router.replace('/(tabs)/account');
}
