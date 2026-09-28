import commonEn from './catalogs/en/common.json' with { type: 'json' };
import commonMe from './catalogs/me/common.json' with { type: 'json' };
import commonRu from './catalogs/ru/common.json' with { type: 'json' };
import commonTr from './catalogs/tr/common.json' with { type: 'json' };
import type { Locale } from './locales.js';

/** A nested ICU message catalog: leaves are message strings, branches are namespaced groups. */
export type MessageTree = { readonly [key: string]: string | MessageTree };

/**
 * The `common` namespace, typed from the `en` catalog (the source of truth — see ADR-0004).
 * All locale catalogs are validated (key parity + ICU syntax) against this shape in tests.
 */
export type CommonMessages = typeof commonEn;

/** Union of every dot-separated leaf path in a message tree, e.g. `'languages.en'`. */
export type MessageKey<T = CommonMessages, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends MessageTree
      ? MessageKey<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

/** Namespaced message catalogs bundled by this package. */
export interface Namespaces {
  readonly common: CommonMessages;
}

/** All catalogs for a single locale. */
export type LocaleCatalogs = Namespaces;

/** Every namespaced catalog for every supported locale, keyed by {@link Locale}. */
export const catalogs: Readonly<Record<Locale, LocaleCatalogs>> = {
  en: { common: commonEn },
  me: { common: commonMe as CommonMessages },
  ru: { common: commonRu as CommonMessages },
  tr: { common: commonTr as CommonMessages },
};

/**
 * Flattens a nested message tree into `{ 'a.b.c': 'value' }` pairs. Useful for key-parity checks
 * and for consumers (e.g. i18next) that expect flat, dot-separated keys.
 */
export function flattenMessages(tree: MessageTree, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[path] = value;
    } else {
      Object.assign(result, flattenMessages(value, path));
    }
  }
  return result;
}
