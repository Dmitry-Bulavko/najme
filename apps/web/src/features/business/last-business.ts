/** localStorage key for the last opened business in business mode (#80). */
export const LAST_BUSINESS_STORAGE_KEY = 'najme.lastBusinessId';

/** Read the last-used business id; missing or blocked storage → null. */
export function readLastBusinessId(): string | null {
  try {
    const value = window.localStorage.getItem(LAST_BUSINESS_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the last-used business id (best-effort). */
export function writeLastBusinessId(businessId: string): void {
  try {
    window.localStorage.setItem(LAST_BUSINESS_STORAGE_KEY, businessId);
  } catch {
    // Ignore quota / private-mode failures — picker still works without memory.
  }
}

/** Clear the remembered business (e.g. when switching to client mode). */
export function clearLastBusinessId(): void {
  try {
    window.localStorage.removeItem(LAST_BUSINESS_STORAGE_KEY);
  } catch {
    // ignore
  }
}
