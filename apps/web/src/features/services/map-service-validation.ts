import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/client';

type IssueLike = { path?: unknown };

/**
 * Maps API `VALIDATION_FAILED` onto react-hook-form fields.
 * Handles zod `details.issues[].path` and service-level `{ staffMemberIds: string[] }`.
 * `price` / `price.amount` → `priceAmount`; nested option paths collapse to `customFields.N.options`.
 */
export function mapServiceValidationErrors<TFieldValues extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<TFieldValues>,
  message: string,
): boolean {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED' || !err.details) {
    return false;
  }

  let mapped = false;
  const details = err.details;

  if (Array.isArray(details.staffMemberIds) && details.staffMemberIds.length > 0) {
    setError('staffMemberIds' as FieldPath<TFieldValues>, { message });
    mapped = true;
  }

  const issues = details.issues;
  if (Array.isArray(issues)) {
    for (const issue of issues) {
      if (!issue || typeof issue !== 'object') continue;
      const path = (issue as IssueLike).path;
      if (!Array.isArray(path) || path.length === 0) continue;
      const fieldPath = normalizeServiceIssuePath(path);
      if (!fieldPath) continue;
      setError(fieldPath as FieldPath<TFieldValues>, { message });
      mapped = true;
    }
  }

  return mapped;
}

/** Normalize zod issue paths onto form field names / custom-field error keys. */
export function normalizeServiceIssuePath(path: unknown[]): string | null {
  if (path.length === 0) return null;
  if (path[0] === 'price') {
    return 'priceAmount';
  }
  if (path[0] === 'customFields' && typeof path[1] === 'number') {
    const index = path[1];
    if (path[2] === 'options') {
      return `customFields.${index}.options`;
    }
    if (path.length >= 3 && typeof path[2] === 'string') {
      return `customFields.${index}.${path[2]}`;
    }
    return `customFields.${index}`;
  }
  return path.map(String).join('.');
}
