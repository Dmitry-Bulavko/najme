import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/client';

type IssueLike = { path?: unknown };

/**
 * Maps API `VALIDATION_FAILED` onto react-hook-form fields.
 * Handles zod `details.issues[].path` and service-level `{ staffMemberIds: string[] }`.
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
      const fieldPath = path.map(String).join('.') as FieldPath<TFieldValues>;
      setError(fieldPath, { message });
      mapped = true;
    }
  }

  return mapped;
}
