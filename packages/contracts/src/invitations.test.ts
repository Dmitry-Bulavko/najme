import { describe, expect, it } from 'vitest';
import {
  INVITATION_TTL_DAYS,
  acceptInvitationRequestSchema,
  createInvitationRequestSchema,
  invitationPreviewResponseSchema,
  updateMemberRequestSchema,
} from './invitations.js';

describe('invitations contracts', () => {
  it('requires staffMemberId only for STAFF invites at the API layer', () => {
    expect(
      createInvitationRequestSchema.parse({
        email: 'a@example.com',
        role: 'ADMIN',
      }).role,
    ).toBe('ADMIN');
    expect(
      createInvitationRequestSchema.parse({
        email: 'a@example.com',
        role: 'STAFF',
        staffMemberId: '11111111-1111-4111-8111-111111111111',
      }).staffMemberId,
    ).toBeTruthy();
  });

  it('parses preview and accept shapes', () => {
    expect(INVITATION_TTL_DAYS).toBe(7);
    expect(
      invitationPreviewResponseSchema.parse({
        businessName: 'Salon',
        logoUrl: null,
        role: 'ADMIN',
        inviterDisplayName: 'Ada',
        emailMasked: 'a***@example.com',
        expiresAt: '2026-10-08T12:00:00.000Z',
      }).emailMasked,
    ).toContain('***');
    expect(acceptInvitationRequestSchema.parse({ token: 'abc' }).token).toBe('abc');
  });

  it('requires at least one field on member update', () => {
    expect(() => updateMemberRequestSchema.parse({})).toThrow();
    expect(updateMemberRequestSchema.parse({ role: 'ADMIN' }).role).toBe('ADMIN');
  });
});
