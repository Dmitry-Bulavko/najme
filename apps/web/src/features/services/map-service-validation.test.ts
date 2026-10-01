import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';

import { mapServiceValidationErrors } from './map-service-validation';

describe('mapServiceValidationErrors', () => {
  it('maps staffMemberIds detail array', () => {
    const setError = vi.fn();
    const mapped = mapServiceValidationErrors(
      new ApiError('VALIDATION_FAILED', 'x', 422, {
        staffMemberIds: ['33333333-3333-4333-8333-333333333333'],
      }),
      setError,
      'invalid',
    );
    expect(mapped).toBe(true);
    expect(setError).toHaveBeenCalledWith('staffMemberIds', { message: 'invalid' });
  });

  it('maps nested customFields issue paths', () => {
    const setError = vi.fn();
    const mapped = mapServiceValidationErrors(
      new ApiError('VALIDATION_FAILED', 'x', 400, {
        issues: [{ path: ['customFields', 0, 'key'] }],
      }),
      setError,
      'invalid',
    );
    expect(mapped).toBe(true);
    expect(setError).toHaveBeenCalledWith('customFields.0.key', { message: 'invalid' });
  });
});
