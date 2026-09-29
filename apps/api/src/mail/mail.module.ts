import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { Mailer } from './mailer.js';
import { SmtpMailer } from './smtp.mailer.js';

@Module({
  providers: [{ provide: Mailer, useClass: SmtpMailer }, MailService],
  exports: [MailService, Mailer],
})
export class MailModule {}
