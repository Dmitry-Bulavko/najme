import { describe, expect, it } from 'vitest';
import { adminBusinessListQuerySchema, rejectBusinessRequestSchema } from './admin.js';

describe('admin contracts', () => {
  it('defaults list status to PENDING_APPROVAL', () => {
    expect(adminBusinessListQuerySchema.parse({}).status).toBe('PENDING_APPROVAL');
    expect(adminBusinessListQuerySchema.parse({}).limit).toBe(20);
  });

  it('requires a reject reason of 10–500 characters', () => {
    expect(() => rejectBusinessRequestSchema.parse({ reason: 'too short' })).toThrow();
    expect(rejectBusinessRequestSchema.parse({ reason: 'Needs more documentation.' }).reason).toBe(
      'Needs more documentation.',
    );
  });
});
