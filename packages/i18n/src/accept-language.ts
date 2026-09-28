const Q_PARAM_PATTERN = /^q=([\d.]+)$/i;

interface ParsedEntry {
  readonly tag: string;
  readonly q: number;
  readonly index: number;
}

/**
 * Parses an HTTP `Accept-Language` header value into a list of language tags ordered by
 * descending `q` value (ties keep their original relative order). Entries with `q=0`, malformed
 * `q` values treated as invalid, blank segments and duplicate tags (case-insensitive) are dropped.
 * The wildcard (`*`) is kept as-is; callers (e.g. {@link resolveLocale}) treat it as unresolvable.
 *
 * @example
 * parseAcceptLanguage('da, en-gb;q=0.8, en;q=0.9') // -> ['da', 'en', 'en-gb']
 */
export function parseAcceptLanguage(header: string): string[] {
  if (!header || !header.trim()) {
    return [];
  }

  const parsed: ParsedEntry[] = [];

  header.split(',').forEach((rawEntry, index) => {
    const entry = rawEntry.trim();
    if (!entry) {
      return;
    }

    const [rawTag, ...params] = entry.split(';').map((part) => part.trim());
    if (!rawTag) {
      return;
    }

    let q = 1;
    for (const param of params) {
      const match = Q_PARAM_PATTERN.exec(param);
      if (!match?.[1]) {
        continue;
      }
      const value = Number(match[1]);
      if (!Number.isNaN(value)) {
        q = value;
      }
    }

    if (q <= 0) {
      return;
    }

    parsed.push({ tag: rawTag, q, index });
  });

  parsed.sort((a, b) => b.q - a.q || a.index - b.index);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const { tag } of parsed) {
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(tag);
  }
  return result;
}
