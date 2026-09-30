/**
 * Refresh-token persistence for mobile (ADR-0010).
 *
 * Uses `expo-secure-store` on native. On web (CI `expo export` / Expo web) SecureStore is
 * unavailable — fall back to in-memory only so the bundle loads without crashing; web is not a
 * supported mobile auth surface.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const REFRESH_TOKEN_KEY = 'najme.refreshToken';

let memoryRefreshToken: string | null = null;

function supportsSecureStore(): boolean {
  return Platform.OS !== 'web';
}

export async function getRefreshToken(): Promise<string | null> {
  if (!supportsSecureStore()) {
    return memoryRefreshToken;
  }
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setRefreshToken(token: string): Promise<void> {
  if (!supportsSecureStore()) {
    // Web fallback: keep in memory only (SecureStore unavailable — web is not a supported auth
    // surface, but the bundle must load without crashing during `expo export --platform web`).
    memoryRefreshToken = token;
    return;
  }
  // Native: persist in SecureStore only; do not duplicate in module memory (ADR-0010).
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
}

export async function clearRefreshToken(): Promise<void> {
  memoryRefreshToken = null;
  if (!supportsSecureStore()) {
    return;
  }
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch {
    // Missing key or unavailable store — treat as already cleared.
  }
}
