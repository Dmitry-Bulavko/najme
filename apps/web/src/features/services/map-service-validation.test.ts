import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';

import { mapServiceValidationErrors, normalizeServiceIssuePath } from './map-service-validation';

describe('normalizeServiceIssuePath', () => {
  it('maps price paths onto priceAmount', () => {
    expect(normalizeServiceIssuePath(['price'])).toBe('priceAmount');
    expect(normalizeServiceIssuePath(['price', 'amount'])).toBe('priceAmount');
  });

  it('collapses nested option paths onto customFields.N.options', () => {
    expect(normalizeServiceIssuePath(['customFields', 0, 'options', 1, 'label'])).toBe(
      'customFields.0.options',
    );
  });
});

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

  it('maps price.amount onto priceAmount', () => {
    const setError = vi.fn();
    const mapped = mapServiceValidationErrors(
      new ApiError('VALIDATION_FAILED', 'x', 400, {
        issues: [{ path: ['price', 'amount'] }],
      }),
      setError,
      'invalid',
    );
    expect(mapped).toBe(true);
    expect(setError).toHaveBeenCalledWith('priceAmount', { message: 'invalid' });
  });
});
