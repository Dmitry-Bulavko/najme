import { catalogs, type Locale } from '@najme/i18n';

export type EmailKind = 'verifyEmail' | 'resetPassword';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Lifetimes quoted in the emails; the token services use the same constants. */
export const EMAIL_TOKEN_TTL_HOURS = { verifyEmail: 24, resetPassword: 1 } as const;

// Values copied from `@najme/ui-tokens` colors (email clients cannot use CSS variables or classes):
// primary, text01, text03 flattened onto white, background, base01.
const COLOR = {
  brand: '#526ED3',
  text: '#151D34',
  muted: '#6B6D7F',
  bg: '#FBFCFF',
  card: '#FFFFFF',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Minimal ICU rendering for the `emails` catalog: `{hours, plural, ...}` with `#`, chosen with the
 * locale's CLDR plural rules. Enough for these messages; a full ICU formatter is not worth a
 * dependency until emails need more.
 */
export function formatMessage(message: string, locale: Locale, values: { hours: number }): string {
  const plural = /\{hours, plural, ((?:[a-z]+ \{[^}]*\} ?)+)\}/.exec(message);
  if (!plural) return message.replaceAll('{hours}', String(values.hours));
  const forms = new Map<string, string>();
  for (const match of plural[1]!.matchAll(/([a-z]+) \{([^}]*)\}/g)) {
    forms.set(match[1]!, match[2]!);
  }
  const category = new Intl.PluralRules(locale === 'me' ? 'sr-Latn' : locale).select(values.hours);
  const form = forms.get(category) ?? forms.get('other') ?? '';
  return message.replace(plural[0], form.replaceAll('#', String(values.hours)));
}

/** Renders the localized text and HTML parts of a transactional email that carries one link. */
export function renderEmail(kind: EmailKind, locale: Locale, url: string): RenderedEmail {
  const { layout, [kind]: m } = catalogs[locale].emails;
  const expiry = formatMessage(m.expiry, locale, { hours: EMAIL_TOKEN_TTL_HOURS[kind] });

  const text = [
    m.heading,
    '',
    m.intro,
    '',
    `${m.action}: ${url}`,
    '',
    expiry,
    m.ignore,
    '',
    `-- ${layout.brand}`,
    layout.footer,
    '',
  ].join('\n');

  const safeUrl = escapeHtml(url);
  const html = `<!doctype html>
<html lang="${locale === 'me' ? 'sr-Latn' : locale}">
<body style="margin:0;padding:24px;background:${COLOR.bg};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLOR.card};border-radius:12px;">
      <tr><td style="padding:24px 32px 0;font-size:20px;font-weight:700;color:${COLOR.brand};">${escapeHtml(layout.brand)}</td></tr>
      <tr><td style="padding:16px 32px 0;font-size:22px;font-weight:600;">${escapeHtml(m.heading)}</td></tr>
      <tr><td style="padding:12px 32px 0;font-size:15px;line-height:22px;">${escapeHtml(m.intro)}</td></tr>
      <tr><td style="padding:24px 32px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:${COLOR.brand};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(m.action)}</a></td></tr>
      <tr><td style="padding:0 32px;font-size:13px;line-height:20px;color:${COLOR.muted};">${escapeHtml(expiry)} ${escapeHtml(m.ignore)}</td></tr>
      <tr><td style="padding:16px 32px 0;font-size:13px;line-height:20px;color:${COLOR.muted};">${escapeHtml(layout.linkFallback)}<br><a href="${safeUrl}" style="color:${COLOR.brand};word-break:break-all;">${safeUrl}</a></td></tr>
      <tr><td style="padding:24px 32px;font-size:12px;color:${COLOR.muted};">${escapeHtml(layout.footer)}</td></tr>
    </table>
  </td></tr></table>
</body>
</html>
`;

  return { subject: m.subject, text, html };
}
