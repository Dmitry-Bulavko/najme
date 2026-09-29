import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.schema.js';
import { ENV } from '../config/env.token.js';
import { Mailer, type MailMessage } from './mailer.js';

const SMTP_TIMEOUT_MS = 10_000;

/** SMTP transport (Mailpit in dev and CI). Plain text + HTML alternative in one message. */
@Injectable()
export class SmtpMailer extends Mailer implements OnApplicationShutdown {
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(@Inject(ENV) env: Env) {
    super();
    this.from = env.MAIL_FROM;
    this.transport = createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Implicit TLS only on 465; other ports upgrade with STARTTLS when the server offers it.
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  onApplicationShutdown(): void {
    this.transport.close();
  }
}
