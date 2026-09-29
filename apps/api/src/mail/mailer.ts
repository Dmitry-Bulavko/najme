/** A fully rendered outgoing email. */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * Transport seam: production code depends on this abstract class (usable as a DI token), tests
 * substitute a fake. The real provider is chosen in M5; until then it is plain SMTP.
 */
export abstract class Mailer {
  abstract send(message: MailMessage): Promise<void>;
}
