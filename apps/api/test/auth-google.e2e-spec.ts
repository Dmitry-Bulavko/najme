import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authProvidersSchema, authSessionSchema } from '@najme/contracts';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GoogleIdTokenVerifier } from '../src/auth/google-id-token-verifier.js';
import { ENV } from '../src/config/env.token.js';
import { Mailer } from '../src/mail/mailer.js';
import { MailService } from '../src/mail/mail.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { FakeGoogleVerifier } from './support/fake-google-verifier.js';
import { FakeMailer } from './support/fake-mailer.js';

const PASSWORD = 'correct horse battery';

// Google sign-in with a fake verifier and mailer (no network). Requires Postgres at `DATABASE_URL`.
describe('Google sign-in (e2e)', () => {
  let app: INestApplication;
  let disabledApp: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const verifier = new FakeGoogleVerifier();

  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  let ipCounter = 0;
  const post = (path: string, target: INestApplication = app) =>
    request(target.getHttpServer())
      .post(`/api/v1${path}`)
      .set('X-Forwarded-For', `10.8.${Math.floor(ipCounter / 250)}.${ipCounter++ % 250}`)
      .set('Content-Type', 'application/json');

  const google = (idToken: string, extra: Record<string, unknown> = {}) =>
    post('/auth/google').send({ idToken, ...extra });

  async function build(overrideEnv?: (env: Record<string, unknown>) => Record<string, unknown>) {
    let builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(Mailer)
      .useValue(new FakeMailer())
      .overrideProvider(GoogleIdTokenVerifier)
      .useValue(verifier);
    if (overrideEnv) {
      // Same env as the app would load, with a tweak.
      const { loadEnv } = await import('../src/config/env.schema.js');
      builder = builder.overrideProvider(ENV).useValue(overrideEnv({ ...loadEnv() }));
    }
    const moduleRef = await builder.compile();
    const instance = moduleRef.createNestApplication();
    configureApp(instance);
    await instance.init();
    return instance;
  }

  beforeAll(async () => {
    app = await build();
    disabledApp = await build((env) => ({ ...env, GOOGLE_CLIENT_IDS: [] }));
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
  });

  afterEach(async () => {
    await mail.idle();
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await disabledApp.close();
    await app.close();
  });

  it('creates a user from the token claims and verifies the email', async () => {
    const address = email('new');
    const token = verifier.issue('t-new', {
      sub: `sub-${suffix}-new`,
      email: address.toUpperCase(),
      name: 'Ana Perovic',
      picture: 'https://lh3.googleusercontent.com/a/ana',
    });
    const res = await google(token, { locale: 'ru' });

    expect(res.status).toBe(200);
    expect(verifier.lastAudiences).toEqual([
      'test-web.apps.googleusercontent.com',
      'test-ios.apps.googleusercontent.com',
    ]);
    const session = authSessionSchema.parse(res.body);
    expect(session.refreshToken).toBeUndefined();
    expect(String(res.headers['set-cookie'])).toContain('HttpOnly');
    expect(session.user).toMatchObject({
      email: address,
      displayName: 'Ana Perovic',
      avatarUrl: 'https://lh3.googleusercontent.com/a/ana',
      locale: 'ru',
      hasPassword: false,
    });
    expect(session.user.emailVerified).toBe(true);
    const identities = await prisma.authIdentity.findMany({ where: { userId: session.user.id } });
    expect(identities).toHaveLength(1);
    expect(identities[0]).toMatchObject({
      provider: 'GOOGLE',
      providerAccountId: `sub-${suffix}-new`,
    });

    const me = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${session.accessToken}`);
    expect(me.status).toBe(200);
  });

  it('takes the locale from Accept-Language when the body has none', async () => {
    const token = verifier.issue('t-lang', { sub: `sub-${suffix}-lang`, email: email('lang') });
    const res = await post('/auth/google')
      .set('Accept-Language', 'tr-TR,tr;q=0.9')
      .send({ idToken: token });
    expect(res.status).toBe(200);
    expect(res.body.user.locale).toBe('tr');
  });

  it('returns the refresh token in the body for mobile clients', async () => {
    const token = verifier.issue('t-mobile', {
      sub: `sub-${suffix}-mobile`,
      email: email('mobile'),
    });
    const res = await post('/auth/google').set('X-Client', 'mobile').send({ idToken: token });
    expect(res.status).toBe(200);
    expect(authSessionSchema.parse(res.body).refreshToken).toBeTruthy();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('signs a returning Google user in without creating another account', async () => {
    const address = email('again');
    const token = verifier.issue('t-again', { sub: `sub-${suffix}-again`, email: address });
    const first = await google(token, { locale: 'me' });
    // Even when the email at Google changed, the `sub` decides.
    const moved = verifier.issue('t-again-2', {
      sub: `sub-${suffix}-again`,
      email: email('other-address'),
    });
    const second = await google(moved, { locale: 'tr' });

    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.locale).toBe('me');
    expect(await prisma.user.count({ where: { id: first.body.user.id } })).toBe(1);
    expect(await prisma.authIdentity.count({ where: { userId: first.body.user.id } })).toBe(1);
  });

  it('keeps signing in by sub and leaves the account owning the new email untouched', async () => {
    const x = email('conflict-a-x');
    const y = email('conflict-a-y');
    const other = await post('/auth/register').send({ email: y, password: PASSWORD });
    expect(other.status).toBe(201);
    const first = await google(verifier.issue('t-ca1', { sub: `sub-${suffix}-ca`, email: x }));
    const second = await google(verifier.issue('t-ca2', { sub: `sub-${suffix}-ca`, email: y }));

    expect(second.status).toBe(200);
    expect(second.body.user.id).toBe(first.body.user.id);
    expect(second.body.user.id).not.toBe(other.body.user.id);
    expect(
      await prisma.authIdentity.findMany({
        where: { userId: other.body.user.id },
        select: { provider: true },
      }),
    ).toEqual([{ provider: 'PASSWORD' }]);
    const login = await post('/auth/login').send({ email: y, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(other.body.user.id);
  });

  it('answers 409 when another Google account claims an already linked email', async () => {
    const x = email('conflict-b');
    const first = await google(verifier.issue('t-cb1', { sub: `sub-${suffix}-cb-a`, email: x }));
    expect(first.status).toBe(200);
    const res = await google(verifier.issue('t-cb2', { sub: `sub-${suffix}-cb-b`, email: x }));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    const identities = await prisma.authIdentity.findMany({
      where: { userId: first.body.user.id },
      select: { provider: true, providerAccountId: true },
    });
    expect(identities).toEqual([{ provider: 'GOOGLE', providerAccountId: `sub-${suffix}-cb-a` }]);
  });

  it('links to an existing verified password user, whose password keeps working', async () => {
    const address = email('verified');
    const reg = await post('/auth/register').send({ email: address, password: PASSWORD });
    expect(reg.status).toBe(201);
    await prisma.user.update({
      where: { id: reg.body.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    const token = verifier.issue('t-link', { sub: `sub-${suffix}-link`, email: address });

    const res = await google(token);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(reg.body.user.id);
    expect(res.body.user.hasPassword).toBe(true);
    const providers = await prisma.authIdentity.findMany({
      where: { userId: reg.body.user.id },
      select: { provider: true },
    });
    expect(providers.map((i) => i.provider).sort()).toEqual(['GOOGLE', 'PASSWORD']);
    const login = await post('/auth/login').send({ email: address, password: PASSWORD });
    expect(login.status).toBe(200);
  });

  it('links to an unverified password user and wipes the password (pre-hijacking)', async () => {
    const address = email('unverified');
    const reg = await post('/auth/register').send({ email: address, password: PASSWORD });
    expect(reg.status).toBe(201);
    const cookie = String(reg.headers['set-cookie']);
    expect(reg.body.user.emailVerified).toBe(false);
    const token = verifier.issue('t-hijack', { sub: `sub-${suffix}-hijack`, email: address });

    const res = await google(token);

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(reg.body.user.id);
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.hasPassword).toBe(false);
    const login = await post('/auth/login').send({ email: address, password: PASSWORD });
    expect(login.status).toBe(401);
    expect(login.body.error.code).toBe('INVALID_CREDENTIALS');
    const refresh = await post('/auth/refresh').set('Cookie', cookie.split(';')[0]!).send({});
    expect(refresh.status).toBe(401);
    expect(
      await prisma.emailToken.count({ where: { userId: reg.body.user.id, usedAt: null } }),
    ).toBe(0);
  });

  it('rejects a token whose email is not verified with 401 GOOGLE_TOKEN_INVALID', async () => {
    const address = email('noverify');
    const token = verifier.issue('t-unv', {
      sub: `sub-${suffix}-unv`,
      email: address,
      emailVerified: false,
    });
    const res = await google(token);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
    expect(await prisma.user.count({ where: { email: address } })).toBe(0);
  });

  it('rejects a token the verifier does not accept with 401 GOOGLE_TOKEN_INVALID', async () => {
    const res = await google('forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
    expect(JSON.stringify(res.body)).not.toContain('bad token');
  });

  it('validates the body', async () => {
    const res = await post('/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('answers 503 GOOGLE_SIGN_IN_DISABLED when no client IDs are configured', async () => {
    const token = verifier.issue('t-off', { sub: `sub-${suffix}-off`, email: email('off') });
    const res = await post('/auth/google', disabledApp).send({ idToken: token });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GOOGLE_SIGN_IN_DISABLED');
  });

  it('is rate limited', async () => {
    const ip = '10.7.7.7';
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/google')
        .set('X-Forwarded-For', ip)
        .set('Content-Type', 'application/json')
        .send({ idToken: 'forged' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  describe('GET /auth/providers', () => {
    it('reports google enabled without authentication', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/providers');
      expect(res.status).toBe(200);
      expect(authProvidersSchema.parse(res.body)).toEqual({ google: true });
    });

    it('reports google disabled when unconfigured', async () => {
      const res = await request(disabledApp.getHttpServer()).get('/api/v1/auth/providers');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ google: false });
    });
  });
});
