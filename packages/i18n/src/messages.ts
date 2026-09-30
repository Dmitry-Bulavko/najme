import accountEn from './catalogs/en/account.json' with { type: 'json' };
import authEn from './catalogs/en/auth.json' with { type: 'json' };
import commonEn from './catalogs/en/common.json' with { type: 'json' };
import emailsEn from './catalogs/en/emails.json' with { type: 'json' };
import errorsEn from './catalogs/en/errors.json' with { type: 'json' };
import mobileEn from './catalogs/en/mobile.json' with { type: 'json' };
import shellEn from './catalogs/en/shell.json' with { type: 'json' };
import accountMe from './catalogs/me/account.json' with { type: 'json' };
import authMe from './catalogs/me/auth.json' with { type: 'json' };
import commonMe from './catalogs/me/common.json' with { type: 'json' };
import emailsMe from './catalogs/me/emails.json' with { type: 'json' };
import errorsMe from './catalogs/me/errors.json' with { type: 'json' };
import mobileMe from './catalogs/me/mobile.json' with { type: 'json' };
import shellMe from './catalogs/me/shell.json' with { type: 'json' };
import accountRu from './catalogs/ru/account.json' with { type: 'json' };
import authRu from './catalogs/ru/auth.json' with { type: 'json' };
import commonRu from './catalogs/ru/common.json' with { type: 'json' };
import emailsRu from './catalogs/ru/emails.json' with { type: 'json' };
import errorsRu from './catalogs/ru/errors.json' with { type: 'json' };
import mobileRu from './catalogs/ru/mobile.json' with { type: 'json' };
import shellRu from './catalogs/ru/shell.json' with { type: 'json' };
import accountTr from './catalogs/tr/account.json' with { type: 'json' };
import authTr from './catalogs/tr/auth.json' with { type: 'json' };
import commonTr from './catalogs/tr/common.json' with { type: 'json' };
import emailsTr from './catalogs/tr/emails.json' with { type: 'json' };
import errorsTr from './catalogs/tr/errors.json' with { type: 'json' };
import mobileTr from './catalogs/tr/mobile.json' with { type: 'json' };
import shellTr from './catalogs/tr/shell.json' with { type: 'json' };
import type { Locale } from './locales.js';

/** A nested ICU message catalog: leaves are message strings, branches are namespaced groups. */
export type MessageTree = { readonly [key: string]: string | MessageTree };

/**
 * The `common` namespace, typed from the `en` catalog (the source of truth — see ADR-0004).
 * All locale catalogs are validated (key parity + ICU syntax) against this shape in tests.
 */
export type CommonMessages = typeof commonEn;

/** The `errors` namespace: one message per API error code, keyed by the bare `<CODE>`. */
export type ErrorMessages = typeof errorsEn;

/** The `shell` namespace: app shell, navigation, home page and dev showcase strings. */
export type ShellMessages = typeof shellEn;

/** The `mobile` namespace (Expo app UI kit, shell and screens), typed from the `en` catalog. */
export type MobileMessages = typeof mobileEn;

/** The `emails` namespace: transactional email subjects and bodies (#49). */
export type EmailMessages = typeof emailsEn;

/** The `auth` namespace: web sign-in, sign-up, and account header strings (#52). */
export type AuthMessages = typeof authEn;

/** The `account` namespace: web profile and settings page (#54). */
export type AccountMessages = typeof accountEn;

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
  readonly errors: ErrorMessages;
  readonly shell: ShellMessages;
  readonly mobile: MobileMessages;
  readonly emails: EmailMessages;
  readonly auth: AuthMessages;
  readonly account: AccountMessages;
}

/** All catalogs for a single locale. */
export type LocaleCatalogs = Namespaces;

/** Every namespaced catalog for every supported locale, keyed by {@link Locale}. */
export const catalogs: Readonly<Record<Locale, LocaleCatalogs>> = {
  en: {
    common: commonEn,
    errors: errorsEn,
    shell: shellEn,
    mobile: mobileEn,
    emails: emailsEn,
    auth: authEn,
    account: accountEn,
  },
  me: {
    common: commonMe as CommonMessages,
    errors: errorsMe,
    shell: shellMe,
    mobile: mobileMe as MobileMessages,
    emails: emailsMe as EmailMessages,
    auth: authMe as AuthMessages,
    account: accountMe as AccountMessages,
  },
  ru: {
    common: commonRu as CommonMessages,
    errors: errorsRu,
    shell: shellRu,
    mobile: mobileRu as MobileMessages,
    emails: emailsRu as EmailMessages,
    auth: authRu as AuthMessages,
    account: accountRu as AccountMessages,
  },
  tr: {
    common: commonTr as CommonMessages,
    errors: errorsTr,
    shell: shellTr,
    mobile: mobileTr as MobileMessages,
    emails: emailsTr as EmailMessages,
    auth: authTr as AuthMessages,
    account: accountTr as AccountMessages,
  },
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
