import { catalogs, type Locale } from '@najme/i18n';
import type { MembershipRole } from '@najme/contracts';
import { INVITATION_TTL_DAYS } from '@najme/contracts';

export type AuthEmailKind = 'verifyEmail' | 'resetPassword';
export type EmailKind = AuthEmailKind | 'businessInvitation';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export type InvitationEmailValues = {
  businessName: string;
  inviterName: string;
  role: MembershipRole;
  url: string;
};

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
 * Minimal ICU rendering for the `emails` catalog: `{name, plural, ...}` with `#`, chosen with the
 * locale's CLDR plural rules. Also replaces `{name}` plain placeholders from `values`.
 */
export function formatMessage(
  message: string,
  locale: Locale,
  values: Record<string, string | number>,
): string {
  let out = message;
  for (const [name, raw] of Object.entries(values)) {
    if (typeof raw !== 'number') continue;
    const plural = new RegExp(`\\{${name}, plural, ((?:[a-z]+ \\{[^}]*\\} ?)+)\\}`).exec(out);
    if (!plural) continue;
    const forms = new Map<string, string>();
    for (const match of plural[1]!.matchAll(/([a-z]+) \{([^}]*)\}/g)) {
      forms.set(match[1]!, match[2]!);
    }
    const category = new Intl.PluralRules(locale === 'me' ? 'sr-Latn' : locale).select(raw);
    const form = forms.get(category) ?? forms.get('other') ?? '';
    const chosen = form.replaceAll('#', String(raw));
    out = out.replace(plural[0], () => chosen);
  }
  for (const [name, raw] of Object.entries(values)) {
    out = out.replaceAll(`{${name}}`, () => String(raw));
  }
  return out;
}

function wrapHtml(
  locale: Locale,
  heading: string,
  intro: string,
  action: string,
  url: string,
  footerLines: string[],
): string {
  const { layout } = catalogs[locale].emails;
  const safeUrl = escapeHtml(url);
  return `<!doctype html>
<html lang="${locale === 'me' ? 'sr-Latn' : locale}">
<body style="margin:0;padding:24px;background:${COLOR.bg};font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLOR.text};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLOR.card};border-radius:12px;">
      <tr><td style="padding:24px 32px 0;font-size:20px;font-weight:700;color:${COLOR.brand};">${escapeHtml(layout.brand)}</td></tr>
      <tr><td style="padding:16px 32px 0;font-size:22px;font-weight:600;">${escapeHtml(heading)}</td></tr>
      <tr><td style="padding:12px 32px 0;font-size:15px;line-height:22px;">${escapeHtml(intro)}</td></tr>
      <tr><td style="padding:24px 32px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:${COLOR.brand};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(action)}</a></td></tr>
      <tr><td style="padding:0 32px;font-size:13px;line-height:20px;color:${COLOR.muted};">${footerLines.map(escapeHtml).join(' ')}</td></tr>
      <tr><td style="padding:16px 32px 0;font-size:13px;line-height:20px;color:${COLOR.muted};">${escapeHtml(layout.linkFallback)}<br><a href="${safeUrl}" style="color:${COLOR.brand};word-break:break-all;">${safeUrl}</a></td></tr>
      <tr><td style="padding:24px 32px;font-size:12px;color:${COLOR.muted};">${escapeHtml(layout.footer)}</td></tr>
    </table>
  </td></tr></table>
</body>
</html>
`;
}

/** Renders the localized text and HTML parts of a transactional email that carries one link. */
export function renderEmail(kind: AuthEmailKind, locale: Locale, url: string): RenderedEmail {
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

  return {
    subject: m.subject,
    text,
    html: wrapHtml(locale, m.heading, m.intro, m.action, url, [expiry, m.ignore]),
  };
}

export function renderInvitationEmail(
  locale: Locale,
  values: InvitationEmailValues,
): RenderedEmail {
  const { layout, businessInvitation: m } = catalogs[locale].emails;
  const role = m.roles[values.role];
  const vars = {
    businessName: values.businessName,
    inviterName: values.inviterName || m.inviterFallback,
    role,
    days: INVITATION_TTL_DAYS,
  };
  const subject = formatMessage(m.subject, locale, vars);
  const heading = formatMessage(m.heading, locale, vars);
  const intro = formatMessage(m.intro, locale, vars);
  const expiry = formatMessage(m.expiry, locale, vars);

  const text = [
    heading,
    '',
    intro,
    '',
    `${m.action}: ${values.url}`,
    '',
    expiry,
    m.ignore,
    '',
    `-- ${layout.brand}`,
    layout.footer,
    '',
  ].join('\n');

  return {
    subject,
    text,
    html: wrapHtml(locale, heading, intro, m.action, values.url, [expiry, m.ignore]),
  };
}
