import { describe, expect, it } from 'vitest';
import { SUPPORTED_LOCALES, catalogs } from '@najme/i18n';
import { formatMessage, renderEmail, renderInvitationEmail } from './email-templates.js';

const URL = 'http://localhost:3001/en/verify-email?token=a-b_c&x=1';

describe('renderEmail', () => {
  it.each(SUPPORTED_LOCALES)('renders both kinds in %s with text and html parts', (locale) => {
    for (const kind of ['verifyEmail', 'resetPassword'] as const) {
      const email = renderEmail(kind, locale, URL);
      expect(email.subject).toBe(catalogs[locale].emails[kind].subject);
      expect(email.text).toContain(URL);
      expect(email.text).not.toContain('{');
      expect(email.html).not.toContain('{hours');
      expect(email.html).toContain(`lang="${locale === 'me' ? 'sr-Latn' : locale}"`);
    }
  });

  it('escapes the link in HTML but not in plain text', () => {
    const email = renderEmail('verifyEmail', 'en', URL);
    expect(email.html).toContain('token=a-b_c&amp;x=1');
    expect(email.text).toContain('token=a-b_c&x=1');
  });

  it('quotes the token lifetime', () => {
    expect(renderEmail('verifyEmail', 'en', URL).text).toContain('24 hours');
    expect(renderEmail('resetPassword', 'en', URL).text).toContain('1 hour ');
  });
});

describe('formatMessage', () => {
  const ru = '{hours, plural, one {# час} few {# часа} many {# часов} other {# часа}}';
  it.each([
    [1, '1 час'],
    [2, '2 часа'],
    [24, '24 часа'],
    [5, '5 часов'],
  ])('picks the Russian plural form for %i', (hours, expected) => {
    expect(formatMessage(ru, 'ru', { hours })).toBe(expected);
  });

  it('substitutes a plain argument', () => {
    expect(formatMessage('{hours} saat', 'tr', { hours: 3 })).toBe('3 saat');
  });
});

describe('formatMessage with special characters', () => {
  it('keeps $ sequences of a translation literal', () => {
    expect(formatMessage('{hours, plural, one {$& # h} other {$1 # h}}', 'en', { hours: 2 })).toBe(
      '$1 2 h',
    );
    expect(formatMessage('a $& {hours}', 'en', { hours: 2 })).toBe('a $& 2');
  });

  it('does not re-expand placeholders that appear inside substituted values', () => {
    expect(
      formatMessage('{inviterName} invited you as {role}', 'en', {
        inviterName: 'Ada {role}',
        role: 'an admin',
      }),
    ).toBe('Ada {role} invited you as an admin');
  });
});

describe('renderInvitationEmail', () => {
  const inviteUrl = 'http://localhost:3001/ru/invitations/accept?token=abc_def';

  it.each(SUPPORTED_LOCALES)('renders %s without leftover placeholders', (locale) => {
    const email = renderInvitationEmail(locale, {
      businessName: 'Salon <script>',
      inviterName: 'Ada',
      role: 'ADMIN',
      url: inviteUrl,
    });
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.text).not.toMatch(/\{[a-zA-Z]/);
    expect(email.html).not.toMatch(/\{[a-zA-Z]/);
    expect(email.html).toContain('Salon &lt;script&gt;');
    expect(email.text).toContain('Salon <script>');
    expect(email.text).toContain(inviteUrl);
  });
});
