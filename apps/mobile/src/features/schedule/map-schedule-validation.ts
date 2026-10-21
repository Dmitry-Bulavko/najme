import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/lib/api/client';

import type { DayDraft } from './working-hours-draft';

type IssueLike = { path?: unknown; message?: string };

/** Map a flat `intervals[i]` index back to the draft weekday/row (`draftToIntervals` order). */
export function intervalIndexToRow(
  days: DayDraft[],
  index: number,
): { weekday: DayDraft['weekday']; rowIndex: number; key: string } | null {
  let cursor = 0;
  for (const day of days) {
    if (day.closed) continue;
    for (let rowIndex = 0; rowIndex < day.intervals.length; rowIndex += 1) {
      const interval = day.intervals[rowIndex];
      if (!interval) continue;
      if (cursor === index) {
        return { weekday: day.weekday, rowIndex, key: interval.key };
      }
      cursor += 1;
    }
  }
  return null;
}

/** Per-interval error messages keyed by draft interval `key`. */
export type RowErrorMap = Record<string, string>;

/** Map zod/API issue paths `['intervals', i, …]` onto draft interval keys. */
export function mapWorkingHoursIssues(
  days: DayDraft[],
  issues: readonly IssueLike[],
  message: string,
): RowErrorMap {
  const errors: RowErrorMap = {};
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const path = issue.path;
    if (!Array.isArray(path) || path[0] !== 'intervals') continue;
    if (typeof path[1] !== 'number') continue;
    const row = intervalIndexToRow(days, path[1]);
    if (!row) continue;
    errors[row.key] = message;
  }
  return errors;
}

/** Map PUT `VALIDATION_FAILED` `details.issues` onto draft interval keys. */
export function mapWorkingHoursApiErrors(
  err: unknown,
  days: DayDraft[],
  message: string,
): RowErrorMap | null {
  if (!isValidationFailedError(err) || !err.details) {
    return null;
  }
  const issues = err.details.issues;
  if (!Array.isArray(issues)) return null;
  const mapped = mapWorkingHoursIssues(days, issues as IssueLike[], message);
  return Object.keys(mapped).length > 0 ? mapped : null;
}

/**
 * Maps time-off create `VALIDATION_FAILED` onto form date/time fields.
 * API paths `start` / `end` land on the date fields (all-day and timed).
 */
export function mapTimeOffValidationErrors<TFieldValues extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<TFieldValues>,
  message: string,
): boolean {
  if (!isValidationFailedError(err) || !err.details) {
    return false;
  }
  const issues = err.details.issues;
  if (!Array.isArray(issues)) return false;

  let mapped = false;
  for (const issue of issues) {
    if (!issue || typeof issue !== 'object') continue;
    const path = (issue as IssueLike).path;
    if (!Array.isArray(path) || path.length === 0) continue;
    const field = path[0];
    if (field === 'start') {
      setError('startDate' as FieldPath<TFieldValues>, { message });
      mapped = true;
    } else if (field === 'end') {
      setError('endDate' as FieldPath<TFieldValues>, { message });
      mapped = true;
    } else if (field === 'reason') {
      setError('reason' as FieldPath<TFieldValues>, { message });
      mapped = true;
    }
  }
  return mapped;
}

/** True when the API rejected with VALIDATION_FAILED (details optional — e.g. >366 days). */
export function isValidationFailedCode(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.code === 'VALIDATION_FAILED';
  }
  if (typeof err !== 'object' || err === null) return false;
  return (err as { code?: unknown }).code === 'VALIDATION_FAILED';
}

/** Duck-type ApiError so tests and ESM mocks still match. Requires `details` for field mapping. */
export function isValidationFailedError(
  err: unknown,
): err is ApiError & { code: 'VALIDATION_FAILED'; details: Record<string, unknown> } {
  if (!isValidationFailedCode(err)) return false;
  if (err instanceof ApiError) {
    return err.details !== undefined;
  }
  const candidate = err as { details?: unknown };
  return typeof candidate.details === 'object' && candidate.details !== null;
}
