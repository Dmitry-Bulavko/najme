import AsyncStorage from '@react-native-async-storage/async-storage';

/** AsyncStorage key for the last opened business in business mode (#85; mirrors web). */
export const LAST_BUSINESS_STORAGE_KEY = 'najme.lastBusinessId';

/** AsyncStorage key for client vs business UI mode (#85). */
export const APP_MODE_STORAGE_KEY = 'najme.appMode';

export type AppMode = 'client' | 'business';

/** Read the last-used business id; missing or blocked storage → null. */
export async function readLastBusinessId(): Promise<string | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_BUSINESS_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the last-used business id (best-effort). */
export async function writeLastBusinessId(businessId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_BUSINESS_STORAGE_KEY, businessId);
  } catch {
    // Ignore quota / private-mode failures — picker still works without memory.
  }
}

/** Clear the remembered business id (used after delete on web; kept for symmetry). */
export async function clearLastBusinessId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_BUSINESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Read persisted app mode; defaults to client when unset or unreadable. */
export async function readAppMode(): Promise<AppMode> {
  try {
    const value = await AsyncStorage.getItem(APP_MODE_STORAGE_KEY);
    return value === 'business' ? 'business' : 'client';
  } catch {
    return 'client';
  }
}

/** Persist client/business UI mode (best-effort). */
export async function writeAppMode(mode: AppMode): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}
