import { catalogs, SUPPORTED_LOCALES } from '@najme/i18n';
import { describe, expect, it } from 'vitest';

describe('merged message namespaces', () => {
  it.each(SUPPORTED_LOCALES)(
    '%s: top-level keys of the namespaces do not collide (request.ts spreads them)',
    (locale) => {
      const seen = new Map<string, string>();
      for (const [namespace, messages] of Object.entries(catalogs[locale])) {
        for (const key of Object.keys(messages)) {
          expect(
            seen.get(key),
            `"${key}" is in both ${seen.get(key)} and ${namespace}`,
          ).toBeUndefined();
          seen.set(key, namespace);
        }
      }
      expect(seen.size).toBeGreaterThan(0);
    },
  );
});
