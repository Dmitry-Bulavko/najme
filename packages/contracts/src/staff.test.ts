import { describe, expect, it } from 'vitest';

import { createStaffMemberRequestSchema, updateStaffMemberRequestSchema } from './staff.js';

describe('createStaffMemberRequestSchema', () => {
  it('requires a non-empty displayName', () => {
    expect(createStaffMemberRequestSchema.safeParse({ displayName: 'Ana' }).success).toBe(true);
    expect(createStaffMemberRequestSchema.safeParse({ displayName: '  ' }).success).toBe(false);
  });
});

describe('updateStaffMemberRequestSchema', () => {
  it('requires at least one field', () => {
    expect(updateStaffMemberRequestSchema.safeParse({}).success).toBe(false);
    expect(updateStaffMemberRequestSchema.safeParse({ active: false }).success).toBe(true);
  });
});
