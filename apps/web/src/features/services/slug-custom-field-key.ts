import { transliterateAscii } from '@najme/contracts';

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

/**
 * Derive a custom-field key from a label. Must match `^[a-z][a-z0-9_]{0,39}$`.
 * Returns '' when nothing usable can be produced (empty / symbol-only label).
 */
export function slugCustomFieldKey(label: string): string {
  const ascii = transliterateAscii(label, '_');

  if (ascii.length === 0) {
    return '';
  }

  let key = ascii;
  if (!/^[a-z]/.test(key)) {
    key = `f_${key}`.replace(/^f_+/, 'f_');
  }
  key = key.slice(0, 40);
  if (!KEY_PATTERN.test(key)) {
    return '';
  }
  return key;
}

export function isValidCustomFieldKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

/** Ensure `candidate` is unique among `existing` (excluding `ignore`). Appends `_2`, `_3`, … */
export function uniqueCustomFieldKey(
  candidate: string,
  existing: readonly string[],
  ignore?: string,
): string {
  if (!candidate) return candidate;
  const taken = new Set(existing.filter((k) => k !== ignore));
  if (!taken.has(candidate)) return candidate;
  for (let n = 2; n < 1000; n += 1) {
    const suffix = `_${n}`;
    const base = candidate.slice(0, Math.max(1, 40 - suffix.length));
    const next = `${base}${suffix}`;
    if (isValidCustomFieldKey(next) && !taken.has(next)) {
      return next;
    }
  }
  return candidate;
}
