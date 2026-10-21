/**
 * Maps an API error `code` to a catalogued `errors.*` string, falling back to `HTTP_ERROR`
 * when the code is missing from the catalog (avoids next-intl missing-key throws).
 */
export type ErrorsTranslator = {
  (key: string): string;
  has: (key: string) => boolean;
};

export function errorMessage(tErrors: ErrorsTranslator, code: string): string {
  if (tErrors.has(code)) {
    return tErrors(code);
  }
  return tErrors('HTTP_ERROR');
}
