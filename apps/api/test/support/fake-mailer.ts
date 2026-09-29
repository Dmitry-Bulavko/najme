import { Mailer, type MailMessage } from '../../src/mail/mailer.js';

/** In-memory {@link Mailer} for tests; `failWith` makes every send reject. */
export class FakeMailer extends Mailer {
  readonly sent: MailMessage[] = [];
  failWith: Error | null = null;

  async send(message: MailMessage): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
  }

  to(address: string): MailMessage[] {
    return this.sent.filter((m) => m.to === address);
  }
}

/** The `token` query parameter of the first link in an email body. */
export function tokenFromEmail(text: string): string {
  const match = /[?&]token=([A-Za-z0-9_-]+)/.exec(text);
  if (!match) throw new Error('no token link in email');
  return match[1]!;
}
