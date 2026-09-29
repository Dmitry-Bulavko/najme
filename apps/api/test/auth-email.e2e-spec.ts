import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authSessionSchema } from '@najme/contracts';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { hashEmailToken } from '../src/auth/email-token.service.js';
import { MailService } from '../src/mail/mail.service.js';
import { Mailer } from '../src/mail/mailer.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeMailer, tokenFromEmail } from './support/fake-mailer.js';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another staple horse';

// Flows with a fake mailer (no SMTP needed); the Mailpit-backed twin is auth-mailpit.e2e-spec.ts.
// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('Auth emails (e2e, fake mailer)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const mailer = new FakeMailer();

  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  let ipCounter = 0;
  const post = (path: string, ip = `10.9.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('X-Forwarded-For', ip)
      .set('Content-Type', 'application/json');

  async function register(address: string, locale?: string) {
    const res = await post('/auth/register').send({
      email: address,
      password: PASSWORD,
      ...(locale ? { locale } : {}),
    });
    expect(res.status).toBe(201);
    await mail.idle();
    return authSessionSchema.parse(res.body);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Mailer)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });

  afterEach(async () => {
    mailer.failWith = null;
    await mail.idle();
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('sign-up verification email', () => {
    it('sends a localized link with a 24h token stored hashed', async () => {
      const address = email('signup');
      const session = await register(address, 'me');

      const [message] = mailer.to(address);
      expect(message?.subject).toBe('Potvrdite svoju e-mail adresu');
      expect(message?.text).toContain('http://localhost:3001/me/verify-email?token=');
      expect(message?.html).toContain('/me/verify-email?token=');
      const raw = tokenFromEmail(message!.text);
      const stored = await prisma.emailToken.findUnique({
        where: { tokenHash: hashEmailToken(raw) },
      });
      expect(stored).toMatchObject({
        userId: session.user.id,
        purpose: 'VERIFY_EMAIL',
        usedAt: null,
      });
      const ttl = stored!.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(23.9 * 3_600_000);
      expect(ttl).toBeLessThanOrEqual(24 * 3_600_000);
      expect(JSON.stringify(stored)).not.toContain(raw);
    });

    it('does not fail registration when sending fails', async () => {
      mailer.failWith = new Error('smtp down');
      const address = email('smtpdown');
      const res = await post('/auth/register').send({ email: address, password: PASSWORD });
      expect(res.status).toBe(201);
      await mail.idle();
      expect(mailer.to(address)).toHaveLength(0);
    });
  });

  describe('POST /auth/verify-email', () => {
    it('verifies the email once and rejects reuse', async () => {
      const address = email('verify');
      const session = await register(address);
      const token = tokenFromEmail(mailer.to(address)[0]!.text);

      const ok = await post('/auth/verify-email').send({ token });
      expect(ok.status).toBe(204);
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      expect(user?.emailVerifiedAt).not.toBeNull();

      const again = await post('/auth/verify-email').send({ token });
      expect(again.status).toBe(400);
      expect(again.body.error.code).toBe('TOKEN_INVALID');
    });

    it('rejects an unknown token', async () => {
      const res = await post('/auth/verify-email').send({ token: 'nope-nope-nope' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });

    it('rejects an expired token with TOKEN_EXPIRED and leaves the user unverified', async () => {
      const address = email('expired');
      const session = await register(address);
      const token = tokenFromEmail(mailer.to(address)[0]!.text);
      await prisma.emailToken.updateMany({
        where: { userId: session.user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await post('/auth/verify-email').send({ token });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
      const user = await prisma.user.findUnique({ where: { id: session.user.id } });
      expect(user?.emailVerifiedAt).toBeNull();
    });

    it('lets only one of two concurrent requests use the token', async () => {
      const address = email('race');
      await register(address);
      const token = tokenFromEmail(mailer.to(address)[0]!.text);
      const results = await Promise.all([
        post('/auth/verify-email').send({ token }),
        post('/auth/verify-email').send({ token }),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([204, 400]);
    });

    it('does not accept a reset token', async () => {
      const address = email('purpose');
      await register(address);
      await post('/auth/forgot-password').send({ email: address });
      await mail.idle();
      const resetToken = tokenFromEmail(mailer.to(address)[1]!.text);
      const res = await post('/auth/verify-email').send({ token: resetToken });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_INVALID');
    });
  });

  describe('POST /auth/verify-email/resend', () => {
    it('requires authentication', async () => {
      const res = await post('/auth/verify-email/resend').send({});
      expect(res.status).toBe(401);
    });

    it('sends a new link and invalidates the previous one', async () => {
      const address = email('resend');
      const session = await register(address);
      const first = tokenFromEmail(mailer.to(address)[0]!.text);

      const res = await post('/auth/verify-email/resend')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({});
      expect(res.status).toBe(202);
      await mail.idle();
      expect(mailer.to(address)).toHaveLength(2);
      const second = tokenFromEmail(mailer.to(address)[1]!.text);
      expect(second).not.toBe(first);

      const old = await post('/auth/verify-email').send({ token: first });
      expect(old.body.error.code).toBe('TOKEN_INVALID');
      expect((await post('/auth/verify-email').send({ token: second })).status).toBe(204);
    });

    it('sends nothing once the email is verified', async () => {
      const address = email('resendverified');
      const session = await register(address);
      await post('/auth/verify-email').send({ token: tokenFromEmail(mailer.to(address)[0]!.text) });
      const res = await post('/auth/verify-email/resend')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({});
      expect(res.status).toBe(202);
      await mail.idle();
      expect(mailer.to(address)).toHaveLength(1);
    });

    it('is rate limited', async () => {
      const address = email('resendlimit');
      const session = await register(address);
      const ip = '10.99.0.1';
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await post('/auth/verify-email/resend', ip)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({});
        statuses.push(res.status);
      }
      expect(statuses).toEqual([202, 202, 202, 429]);
      await mail.idle();
    });
  });

  describe('forgot and reset password', () => {
    it('sends a localized reset link and resets the password, revoking all sessions', async () => {
      const address = email('reset');
      const session = await register(address, 'ru');
      const loginBefore = await post('/auth/login').send({ email: address, password: PASSWORD });
      expect(loginBefore.status).toBe(200);
      const cookieBefore = (loginBefore.headers['set-cookie'] as unknown as string[])[0]!;

      const forgot = await post('/auth/forgot-password').send({ email: address.toUpperCase() });
      expect(forgot.status).toBe(202);
      await mail.idle();
      const message = mailer.to(address)[1]!;
      expect(message.subject).toBe('Сброс пароля');
      expect(message.text).toContain('http://localhost:3001/ru/reset-password?token=');
      const token = tokenFromEmail(message.text);
      const stored = await prisma.emailToken.findUnique({
        where: { tokenHash: hashEmailToken(token) },
      });
      const ttl = stored!.expiresAt.getTime() - Date.now();
      expect(ttl).toBeLessThanOrEqual(3_600_000);
      expect(ttl).toBeGreaterThan(3_500_000);

      const reset = await post('/auth/reset-password').send({ token, newPassword: NEW_PASSWORD });
      expect(reset.status).toBe(204);

      expect((await post('/auth/login').send({ email: address, password: PASSWORD })).status).toBe(
        401,
      );
      expect(
        (await post('/auth/login').send({ email: address, password: NEW_PASSWORD })).status,
      ).toBe(200);

      // Only the session created by the login after the reset is alive; the pre-reset ones are not.
      const active = await prisma.refreshToken.count({
        where: { userId: session.user.id, revokedAt: null },
      });
      expect(active).toBe(1);
      const refresh = await post('/auth/refresh')
        .set('Cookie', cookieBefore.split(';')[0]!)
        .send({});
      expect(refresh.status).toBe(401);

      const reuse = await post('/auth/reset-password').send({ token, newPassword: PASSWORD });
      expect(reuse.status).toBe(400);
      expect(reuse.body.error.code).toBe('TOKEN_INVALID');
    });

    it('answers 202 with the same body for an unknown email and sends nothing', async () => {
      const known = email('known');
      await register(known);
      const unknown = `ghost-${suffix}@example.com`;
      const a = await post('/auth/forgot-password').send({ email: known });
      const b = await post('/auth/forgot-password').send({ email: unknown });
      await mail.idle();
      expect(b.status).toBe(202);
      expect(b.status).toBe(a.status);
      expect(b.text).toBe(a.text);
      expect(mailer.to(unknown)).toHaveLength(0);
      expect(mailer.to(known)).toHaveLength(2);
    });

    it('sends no reset email to an account without a password', async () => {
      const address = email('nopass');
      const session = await register(address);
      await prisma.authIdentity.deleteMany({ where: { userId: session.user.id } });
      const res = await post('/auth/forgot-password').send({ email: address });
      expect(res.status).toBe(202);
      await mail.idle();
      expect(mailer.to(address)).toHaveLength(1); // only the sign-up email
    });

    it('rejects an expired reset token and keeps the old password', async () => {
      const address = email('resetexp');
      const session = await register(address);
      await post('/auth/forgot-password').send({ email: address });
      await mail.idle();
      const token = tokenFromEmail(mailer.to(address)[1]!.text);
      await prisma.emailToken.updateMany({
        where: { userId: session.user.id, purpose: 'RESET_PASSWORD' },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await post('/auth/reset-password').send({ token, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
      expect((await post('/auth/login').send({ email: address, password: PASSWORD })).status).toBe(
        200,
      );
    });

    it('validates the new password', async () => {
      const res = await post('/auth/reset-password').send({ token: 'abc', newPassword: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });
  });
});
