import { Inject, Injectable, Logger, type BeforeApplicationShutdown } from '@nestjs/common';
import type { Locale } from '@najme/i18n';
import type { Env } from '../config/env.schema.js';
import { ENV } from '../config/env.token.js';
import {
  renderEmail,
  renderInvitationEmail,
  type AuthEmailKind,
  type EmailKind,
  type InvitationEmailValues,
} from './email-templates.js';
import { Mailer } from './mailer.js';

export interface MailRecipient {
  /** Only the id is ever logged. */
  userId: string | null;
  email: string;
  locale: Locale;
}

const PATH: Record<AuthEmailKind, string> = {
  verifyEmail: 'verify-email',
  resetPassword: 'reset-password',
};

/** Log line for a failed job without any error message text (it may contain an email address). */
export function describeFailure(kind: EmailKind, userId: string | null, error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  const rawCode = (error as { code?: unknown } | null)?.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? ` code=${rawCode}` : '';
  const user = userId ? ` user=${userId}` : '';
  return `Email job failed: kind=${kind}${user} error=${name}${code}`;
}

/**
 * Renders and sends the transactional emails. Sending is fire-and-forget (see
 * `docs/specs/49-mailer-verify-reset.md`): callers never wait for, or fail because of, SMTP.
 * M5 replaces the in-process pending set with a pg-boss queue behind the same methods.
 */
@Injectable()
export class MailService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(MailService.name);
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly mailer: Mailer,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /** `${APP_WEB_URL}/${locale}/<page>?token=…` */
  linkFor(kind: AuthEmailKind, locale: Locale, token: string): string {
    return `${this.env.APP_WEB_URL}/${locale}/${PATH[kind]}?token=${encodeURIComponent(token)}`;
  }

  invitationLink(locale: Locale, token: string): string {
    return `${this.env.APP_WEB_URL}/${locale}/invitations/accept?token=${encodeURIComponent(token)}`;
  }

  /**
   * Runs `job` (typically: issue a token, then call {@link send}) in the background. A failure is
   * logged as job label, optional user id, error name and code, and never propagates. The error
   * message is deliberately left out: Prisma and nodemailer messages embed the queried or
   * addressed email. Pass `userId` null when only an email is known (forgot-password / invite).
   */
  defer(kind: EmailKind, userId: string | null, job: () => Promise<void>): void {
    const run = job().catch((error: unknown) => {
      this.logger.error(describeFailure(kind, userId, error));
    });
    this.pending.add(run);
    void run.finally(() => this.pending.delete(run));
  }

  async send(kind: AuthEmailKind, recipient: MailRecipient, token: string): Promise<void> {
    const rendered = renderEmail(
      kind,
      recipient.locale,
      this.linkFor(kind, recipient.locale, token),
    );
    await this.mailer.send({ to: recipient.email, ...rendered });
  }

  async sendInvitation(
    recipient: MailRecipient,
    values: Omit<InvitationEmailValues, 'url'> & { token: string },
  ): Promise<void> {
    const rendered = renderInvitationEmail(recipient.locale, {
      businessName: values.businessName,
      inviterName: values.inviterName,
      role: values.role,
      url: this.invitationLink(recipient.locale, values.token),
    });
    await this.mailer.send({ to: recipient.email, ...rendered });
  }

  /** Resolves when every deferred job has finished (tests, graceful shutdown). */
  async idle(): Promise<void> {
    while (this.pending.size > 0) await Promise.all([...this.pending]);
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.idle();
  }
}
