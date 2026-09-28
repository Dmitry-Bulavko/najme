/**
 * Tiny module compiled by this package's own `typecheck` script and linted by its own `lint`
 * script, so a regression in `tsconfig/base.json` or the ESLint config fails CI here instead of
 * only surfacing in a downstream consumer.
 */

/** Returns the first element of a non-empty tuple-like array, or `undefined` if it is empty. */
export function firstOf<T>(items: readonly T[]): T | undefined {
  // With `noUncheckedIndexedAccess` enabled, `items[0]` is typed `T | undefined`, so the
  // `| undefined` in the return type above is required, not optional.
  return items[0];
}

/** Formats a count using a locale-aware plural label, defaulting to English pluralisation. */
export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
