import type { Href } from 'expo-router';

import { writeAppMode, writeLastBusinessId, readLastBusinessId } from './last-business';
import type { MyBusiness } from './use-my-businesses';

type ModeRouter = {
  replace: (href: Href) => void;
  push: (href: Href) => void;
};

/**
 * Enter business mode: persist mode, pick last/only/first membership, navigate.
 * When `forcePick` is true (or there are multiple and no last match), go to the picker.
 */
export async function enterBusinessMode(
  router: ModeRouter,
  businesses: readonly MyBusiness[],
  options: { forcePick?: boolean; createPath?: Href } = {},
): Promise<void> {
  await writeAppMode('business');

  if (businesses.length === 0) {
    router.push(options.createPath ?? '/(business)/new');
    return;
  }

  if (options.forcePick) {
    router.push('/(business)/pick');
    return;
  }

  if (businesses.length === 1) {
    const only = businesses[0];
    if (!only) return;
    await writeLastBusinessId(only.businessId);
    router.replace(`/(business)/${only.businessId}`);
    return;
  }

  const last = await readLastBusinessId();
  const match = last ? businesses.find((b) => b.businessId === last) : undefined;
  if (match) {
    await writeLastBusinessId(match.businessId);
    router.replace(`/(business)/${match.businessId}`);
    return;
  }

  router.push('/(business)/pick');
}

/** Leave business mode UI (keeps lastBusinessId, like web client mode). */
export async function enterClientMode(router: Pick<ModeRouter, 'replace'>): Promise<void> {
  await writeAppMode('client');
  router.replace('/(tabs)/account');
}
