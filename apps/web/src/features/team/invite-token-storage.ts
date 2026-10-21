/** sessionStorage key for the invitation token across the auth round-trip (#84). */
export const INVITE_TOKEN_STORAGE_KEY = 'najme.invitation.token';

/** Read a previously stored invite token; missing or blocked storage → null. */
export function readInviteToken(): string | null {
  try {
    const value = sessionStorage.getItem(INVITE_TOKEN_STORAGE_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist the invite token (best-effort) so it survives sign-in/up. */
export function writeInviteToken(token: string): void {
  try {
    sessionStorage.setItem(INVITE_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/** Clear the invite token after accept success or a terminal error. */
export function clearInviteToken(): void {
  try {
    sessionStorage.removeItem(INVITE_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}
