import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authSessionSchema, meSchema } from '@najme/contracts';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { AccessTokenService } from '../src/auth/access-token.service.js';
import { UsersService } from '../src/users/users.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'another long passphrase';

// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('Profile (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  let ipCounter = 0;
  const nextIp = (): string => `10.${Math.floor(ipCounter / 250) % 250}.${ipCounter++ % 250}.9`;

  const call = (method: 'post' | 'patch', path: string, ip = nextIp()) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('X-Forwarded-For', ip)
      .set('Content-Type', 'application/json');

  async function register(address: string) {
    const res = await call('post', '/auth/register')
      .set('X-Client', 'mobile')
      .send({ email: address, password: PASSWORD });
    expect(res.status).toBe(201);
    return authSessionSchema.parse(res.body);
  }
  const refresh = (token: string) =>
    call('post', '/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: token });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails.splice(0) } } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('PATCH /me', () => {
    it('updates the display name only', async () => {
      const session = await register(email('name'));
      const res = await call('patch', '/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ displayName: ' Ana ' });
      expect(res.status).toBe(200);
      expect(meSchema.parse(res.body)).toMatchObject({
        displayName: 'Ana',
        locale: 'en',
        hasPassword: true,
      });
    });

    it('updates the locale only', async () => {
      const session = await register(email('loc'));
      const res = await call('patch', '/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ locale: 'me' });
      expect(res.status).toBe(200);
      expect(meSchema.parse(res.body)).toMatchObject({ locale: 'me', displayName: null });
    });

    it('rejects an invalid locale and an empty body with 400', async () => {
      const session = await register(email('bad'));
      for (const body of [{ locale: 'xx' }, {}]) {
        const res = await call('patch', '/me')
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send(body);
        expect(res.status).toBe(400);
      }
    });

    it('requires authentication', async () => {
      const res = await call('patch', '/me').send({ locale: 'ru' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /me/password', () => {
    it('changes the password, ends other sessions and returns a fresh one', async () => {
      const address = email('pw');
      const first = await register(address);
      const login = await call('post', '/auth/login')
        .set('X-Client', 'mobile')
        .send({ email: address, password: PASSWORD });
      const other = authSessionSchema.parse(login.body);

      const res = await call('post', '/me/password')
        .set('X-Client', 'mobile')
        .set('Authorization', `Bearer ${first.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      const fresh = authSessionSchema.parse(res.body);
      expect(fresh.user.hasPassword).toBe(true);

      // The new session works. Presenting a revoked token counts as reuse and ends every session,
      // so the revoked ones are checked last.
      expect((await refresh(fresh.refreshToken!)).status).toBe(200);
      expect((await refresh(other.refreshToken!)).status).toBe(401);
      expect((await refresh(first.refreshToken!)).status).toBe(401);

      const old = await call('post', '/auth/login').send({ email: address, password: PASSWORD });
      expect(old.status).toBe(401);
      const next = await call('post', '/auth/login').send({
        email: address,
        password: NEW_PASSWORD,
      });
      expect(next.status).toBe(200);
    });

    it('sets the refresh cookie for web clients and no token in the body', async () => {
      const session = await register(email('web'));
      const res = await call('post', '/me/password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body).not.toHaveProperty('refreshToken');
      expect(JSON.stringify(res.headers['set-cookie'])).toContain('najme_rt=');
    });

    it('rejects a wrong current password with 401 INVALID_CREDENTIALS', async () => {
      const session = await register(email('wrong'));
      const res = await call('post', '/me/password')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ currentPassword: 'not the password', newPassword: NEW_PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      // Nothing changed: the old refresh token still works.
      expect((await refresh(session.refreshToken!)).status).toBe(200);
    });

    it('answers 409 PASSWORD_NOT_SET for a Google-only user', async () => {
      const user = await app.get(UsersService).findOrLinkByProvider({
        provider: 'GOOGLE',
        providerAccountId: `g-${suffix}`,
        email: email('google'),
        emailVerified: true,
      });
      const access = await app.get(AccessTokenService).sign(user.id);
      const res = await call('post', '/me/password')
        .set('Authorization', `Bearer ${access.token}`)
        .send({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('PASSWORD_NOT_SET');

      const me = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${access.token}`);
      expect(me.body.hasPassword).toBe(false);
    });

    it('requires authentication', async () => {
      const res = await call('post', '/me/password').send({
        currentPassword: PASSWORD,
        newPassword: NEW_PASSWORD,
      });
      expect(res.status).toBe(401);
    });

    it('is rate limited', async () => {
      const session = await register(email('rate'));
      const ip = nextIp();
      let last = 0;
      for (let i = 0; i < 6; i++) {
        const res = await call('post', '/me/password', ip)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send({ currentPassword: 'nope nope nope', newPassword: NEW_PASSWORD });
        last = res.status;
      }
      expect(last).toBe(429);
    });
  });
});
