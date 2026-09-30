import { createHash, randomBytes } from 'node:crypto';

/** 32 random bytes as base64url (ADR-0011); only the SHA-256 hash is stored. */
export function issueInvitationToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashInvitationToken(raw) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Masks `jane.doe@example.com` → `j***@example.com` (preview must never leak the full address). */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local.charAt(0);
  return `${head}***@${domain}`;
}
