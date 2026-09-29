import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authSessionSchema } from '@najme/contracts';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { MailpitClient } from './support/mailpit.js';
import { tokenFromEmail } from './support/fake-mailer.js';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another staple horse';

// Real SMTP round trip through Mailpit. CI provides it (MAILPIT_URL=http://localhost:8025); locally
// the suite is skipped unless MAILPIT_URL is set (docs/runbooks/local-dev.md).
const MAILPIT_URL = process.env.MAILPIT_URL;

describe.skipIf(!MAILPIT_URL)('Auth emails (e2e, Mailpit)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const mailpit = new MailpitClient(MAILPIT_URL ?? 'http://localhost:8025');

  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  let ipCounter = 0;
  const post = (path: string) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('X-Forwarded-For', `10.8.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`)
      .set('Content-Type', 'application/json');

  async function register(address: string, locale?: string) {
    const res = await post('/auth/register').send({
      email: address,
      password: PASSWORD,
      ...(locale ? { locale } : {}),
    });
    expect(res.status).toBe(201);
    return authSessionSchema.parse(res.body);
  }

  async function latestToken(address: string, count: number): Promise<string> {
    const messages = await mailpit.waitFor(address, count);
    const { text } = await mailpit.text(messages[count - 1]!.ID);
    return tokenFromEmail(text);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });

  afterEach(async () => {
    await mail.idle();
    for (const address of emails) await mailpit.deleteFor(address);
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('delivers a multipart verification email with a working link', async () => {
    const address = email('verify');
    const session = await register(address, 'tr');
    const [first] = await mailpit.waitFor(address);
    expect(first?.Subject).toBe('E-posta adresinizi doğrulayın');
    const { text, html, from } = await mailpit.text(first!.ID);
    expect(from).toBe('no-reply@najme.test');
    expect(text).toContain('/tr/verify-email?token=');
    expect(html).toContain('<a href="http://localhost:3001/tr/verify-email?token=');

    const res = await post('/auth/verify-email').send({ token: tokenFromEmail(text) });
    expect(res.status).toBe(204);
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('rejects a reused verification link', async () => {
    const address = email('reuse');
    await register(address);
    const token = await latestToken(address, 1);
    expect((await post('/auth/verify-email').send({ token })).status).toBe(204);
    const again = await post('/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('TOKEN_INVALID');
  });

  it('rejects an expired verification link', async () => {
    const address = email('expired');
    const session = await register(address);
    const token = await latestToken(address, 1);
    await prisma.emailToken.updateMany({
      where: { userId: session.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await post('/auth/verify-email').send({ token });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('resets a forgotten password through the emailed link and revokes sessions', async () => {
    const address = email('reset');
    const session = await register(address, 'me');
    await mailpit.waitFor(address, 1);

    const forgot = await post('/auth/forgot-password').send({ email: address });
    expect(forgot.status).toBe(202);
    const messages = await mailpit.waitFor(address, 2);
    expect(messages[1]?.Subject).toBe('Resetujte lozinku');
    const { text } = await mailpit.text(messages[1]!.ID);
    expect(text).toContain('/me/reset-password?token=');

    expect(
      await prisma.refreshToken.count({ where: { userId: session.user.id, revokedAt: null } }),
    ).toBe(1);
    const reset = await post('/auth/reset-password').send({
      token: tokenFromEmail(text),
      newPassword: NEW_PASSWORD,
    });
    expect(reset.status).toBe(204);
    expect(
      await prisma.refreshToken.count({ where: { userId: session.user.id, revokedAt: null } }),
    ).toBe(0);
    expect(
      (await post('/auth/login').send({ email: address, password: NEW_PASSWORD })).status,
    ).toBe(200);
    expect((await post('/auth/login').send({ email: address, password: PASSWORD })).status).toBe(
      401,
    );
  });

  it('answers 202 for an unknown email and sends no email', async () => {
    const unknown = email('ghost');
    const res = await post('/auth/forgot-password').send({ email: unknown });
    expect(res.status).toBe(202);
    await mail.idle();
    expect(await mailpit.messagesTo(unknown)).toHaveLength(0);
  });
});
