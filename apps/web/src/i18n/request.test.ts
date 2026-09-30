import { catalogs, SUPPORTED_LOCALES } from '@najme/i18n';
import { describe, expect, it } from 'vitest';

describe('merged message namespaces', () => {
  it.each(SUPPORTED_LOCALES)(
    '%s: top-level keys of namespaces spread in request.ts do not collide',
    (locale) => {
      // Only `common` and `shell` are spread into the message root; nested catalogs keep their key.
      const seen = new Map<string, string>();
      for (const namespace of ['common', 'shell'] as const) {
        for (const key of Object.keys(catalogs[locale][namespace])) {
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
