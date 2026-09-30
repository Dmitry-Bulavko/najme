import { describe, expect, it } from 'vitest';
import { hashInvitationToken, issueInvitationToken, maskEmail } from './invitation-token.js';

describe('invitation-token', () => {
  it('hashes the raw token stably', () => {
    const { raw, hash } = issueInvitationToken();
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hash).toBe(hashInvitationToken(raw));
    expect(hash).not.toBe(raw);
  });

  it('masks emails for preview', () => {
    expect(maskEmail('jane.doe@example.com')).toBe('j***@example.com');
    expect(maskEmail('a@b.co')).toBe('a***@b.co');
  });
});
