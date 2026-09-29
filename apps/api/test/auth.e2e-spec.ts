import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { authSessionSchema, meSchema } from '@najme/contracts';
import { configureApp } from '../src/app.setup.js';
import { AppModule } from '../src/app.module.js';
import { hashRefreshToken } from '../src/auth/refresh-token.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const PASSWORD = 'correct horse battery';

// Requires a reachable Postgres at `DATABASE_URL` with migrations applied.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = randomUUID();
  const emails: string[] = [];
  const email = (name: string): string => {
    const value = `${name}-${suffix}@example.com`;
    emails.push(value);
    return value;
  };
  // The rate limiter keys on the client IP (trust proxy = 1 reads X-Forwarded-For), so every test
  // gets its own address and the limits of one test never leak into another.
  let ipCounter = 0;
  const nextIp = (): string => `10.${Math.floor(ipCounter / 250) % 250}.${ipCounter++ % 250}.7`;

  function client(ip = nextIp()) {
    const send = (path: string) =>
      request(app.getHttpServer())
        .post(`/api/v1${path}`)
        .set('X-Forwarded-For', ip)
        .set('Content-Type', 'application/json');
    return {
      post: send,
      web: (path: string) => send(path),
      mobile: (path: string) => send(path).set('X-Client', 'mobile'),
    };
  }

  const cookieOf = (res: request.Response): string | undefined =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).find((c) =>
      c.startsWith('najme_rt='),
    );
  const tokenFromCookie = (cookie: string | undefined): string =>
    decodeURIComponent((cookie ?? '').split(';')[0]!.slice('najme_rt='.length));

  async function registerWeb(address: string, ip?: string) {
    const c = client(ip);
    const res = await c.web('/auth/register').send({ email: address, password: PASSWORD });
    expect(res.status).toBe(201);
    return { res, cookie: cookieOf(res)!, session: authSessionSchema.parse(res.body) };
  }

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

  describe('register and me', () => {
    it('registers, sets the refresh cookie and lets the access token read /me', async () => {
      const address = email('reg');
      const { res, cookie, session } = await registerWeb(address);

      expect(res.body).not.toHaveProperty('refreshToken');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Path=/api/v1/auth');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Secure'); // NODE_ENV=test is not development
      expect(session.user).toMatchObject({
        email: address,
        emailVerified: false,
        hasPassword: true,
        locale: 'en',
      });

      const me = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${session.accessToken}`);
      expect(me.status).toBe(200);
      expect(meSchema.parse(me.body)).toEqual(session.user);
    });

    it('stores only the SHA-256 hash of the refresh token', async () => {
      const { cookie } = await registerWeb(email('hash'));
      const raw = tokenFromCookie(cookie);
      expect(raw).toHaveLength(43); // 32 bytes, base64url
      const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashRefreshToken(raw) },
      });
      expect(stored).not.toBeNull();
      expect(stored?.tokenHash).not.toBe(raw);
    });

    it('returns 409 EMAIL_TAKEN for a duplicate email, case-insensitively', async () => {
      const address = email('dup');
      await registerWeb(address);
      const res = await client().web('/auth/register').send({
        email: address.toUpperCase(),
        password: PASSWORD,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
    });

    it('returns 400 VALIDATION_FAILED for a short password', async () => {
      const res = await client()
        .web('/auth/register')
        .send({ email: email('short'), password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('takes the locale from the body, else from Accept-Language', async () => {
      const fromHeader = await client()
        .web('/auth/register')
        .set('Accept-Language', 'sr-Latn-ME,sr;q=0.9')
        .send({ email: email('lh'), password: PASSWORD });
      expect(fromHeader.body.user.locale).toBe('me');

      const fromBody = await client()
        .web('/auth/register')
        .set('Accept-Language', 'sr')
        .send({ email: email('lb'), password: PASSWORD, locale: 'tr' });
      expect(fromBody.body.user.locale).toBe('tr');
    });

    it('rejects non-JSON content types on POST endpoints', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', nextIp())
        .type('form')
        .send({ email: 'a@example.com', password: 'x' });
      expect(res.status).toBe(415);
    });
  });

  describe('protected routes', () => {
    it('returns 401 UNAUTHENTICATED on /me without a token, or with a bad one', async () => {
      const missing = await request(app.getHttpServer()).get('/api/v1/me');
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('UNAUTHENTICATED');

      const bad = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer not-a-jwt');
      expect(bad.status).toBe(401);
      expect(bad.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('keeps the health endpoint public', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health');
      expect(res.status).toBe(200);
    });
  });

  describe('login', () => {
    it('signs in with the right password (email is case-insensitive)', async () => {
      const address = email('login');
      await registerWeb(address);
      const res = await client()
        .web('/auth/login')
        .send({ email: address.toUpperCase(), password: PASSWORD });
      expect(res.status).toBe(200);
      authSessionSchema.parse(res.body);
      expect(cookieOf(res)).toBeDefined();
    });

    it('returns the same 401 INVALID_CREDENTIALS for a wrong password and an unknown email', async () => {
      const address = email('bad');
      await registerWeb(address);
      const c = client();
      const wrong = await c.web('/auth/login').send({ email: address, password: 'wrong-password' });
      const unknown = await c
        .web('/auth/login')
        .send({ email: email('nobody'), password: 'wrong-password' });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(cookieOf(wrong)).toBeUndefined();
    });

    it('does not distinguish an account without a password', async () => {
      const address = email('nopw');
      await prisma.user.create({
        data: { id: randomUUID(), email: address, emailVerifiedAt: new Date() },
      });
      const res = await client().web('/auth/login').send({ email: address, password: PASSWORD });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('refresh', () => {
    it('rotates the cookie: the old token stops working, the new one works', async () => {
      const { cookie } = await registerWeb(email('rot'));
      const c = client();

      const first = await c.web('/auth/refresh').set('Cookie', cookie).send({});
      expect(first.status).toBe(200);
      authSessionSchema.parse(first.body);
      const rotated = cookieOf(first)!;
      expect(tokenFromCookie(rotated)).not.toBe(tokenFromCookie(cookie));

      const second = await c.web('/auth/refresh').set('Cookie', rotated).send({});
      expect(second.status).toBe(200);
    });

    it('treats a rotated token as reuse and revokes the whole chain', async () => {
      const { cookie, session } = await registerWeb(email('reuse'));
      const c = client();

      const first = await c.web('/auth/refresh').set('Cookie', cookie).send({});
      const rotated = cookieOf(first)!;

      const replay = await c.web('/auth/refresh').set('Cookie', cookie).send({});
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      // The legitimately rotated token was revoked as part of the chain.
      const afterwards = await c.web('/auth/refresh').set('Cookie', rotated).send({});
      expect(afterwards.status).toBe(401);
      expect(afterwards.body.error.code).toBe('REFRESH_TOKEN_REUSED');
      const active = await prisma.refreshToken.count({
        where: { userId: session.user.id, revokedAt: null },
      });
      expect(active).toBe(0);
    });

    it('rejects a missing or unknown token with 401 UNAUTHENTICATED', async () => {
      const c = client();
      const missing = await c.web('/auth/refresh').send({});
      expect(missing.status).toBe(401);
      expect(missing.body.error.code).toBe('UNAUTHENTICATED');
      const unknown = await c.web('/auth/refresh').set('Cookie', 'najme_rt=nope').send({});
      expect(unknown.status).toBe(401);
      expect(unknown.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects an expired refresh token', async () => {
      const { cookie } = await registerWeb(email('exp'));
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashRefreshToken(tokenFromCookie(cookie)) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await client().web('/auth/refresh').set('Cookie', cookie).send({});
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('lets only one of two concurrent rotations win', async () => {
      const { cookie } = await registerWeb(email('race'));
      const c = client();
      const results = await Promise.all([
        c.web('/auth/refresh').set('Cookie', cookie).send({}),
        c.web('/auth/refresh').set('Cookie', cookie).send({}),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const { cookie } = await registerWeb(email('out'));
      const c = client();

      const res = await c.web('/auth/logout').set('Cookie', cookie).send({});
      expect(res.status).toBe(204);
      expect(cookieOf(res)).toMatch(/^najme_rt=;/);
      expect(cookieOf(res)).toContain('Path=/api/v1/auth');

      const refresh = await c.web('/auth/refresh').set('Cookie', cookie).send({});
      expect(refresh.status).toBe(401);
    });

    it('is idempotent and needs no session', async () => {
      const res = await client().web('/auth/logout').send({});
      expect(res.status).toBe(204);
    });
  });

  describe('web cookie flow vs mobile body flow', () => {
    it('returns the refresh token in the body, and no cookie, for X-Client: mobile', async () => {
      const address = email('mob');
      const c = client();
      const registered = await c
        .mobile('/auth/register')
        .send({ email: address, password: PASSWORD });
      expect(registered.status).toBe(201);
      expect(cookieOf(registered)).toBeUndefined();
      const refreshToken = registered.body.refreshToken as string;
      expect(refreshToken).toHaveLength(43);

      const login = await c.mobile('/auth/login').send({ email: address, password: PASSWORD });
      expect(login.status).toBe(200);
      expect(login.body.refreshToken).toEqual(expect.any(String));
      expect(cookieOf(login)).toBeUndefined();

      const refreshed = await c.mobile('/auth/refresh').send({ refreshToken });
      expect(refreshed.status).toBe(200);
      expect(refreshed.body.refreshToken).toEqual(expect.any(String));
      expect(refreshed.body.refreshToken).not.toBe(refreshToken);

      const replay = await c.mobile('/auth/refresh').send({ refreshToken });
      expect(replay.status).toBe(401);
      expect(replay.body.error.code).toBe('REFRESH_TOKEN_REUSED');

      const logout = await c.mobile('/auth/logout').send({ refreshToken: login.body.refreshToken });
      expect(logout.status).toBe(204);
    });

    it('ignores the cookie for mobile and the body for web', async () => {
      const { cookie } = await registerWeb(email('mix'));
      const c = client();
      const raw = tokenFromCookie(cookie);

      const mobileWithCookie = await c.mobile('/auth/refresh').set('Cookie', cookie).send({});
      expect(mobileWithCookie.status).toBe(401);

      const webWithBody = await c.web('/auth/refresh').send({ refreshToken: raw });
      expect(webWithBody.status).toBe(401);
    });
  });

  describe('rate limiting', () => {
    it('returns 429 RATE_LIMITED after 10 logins per minute from one address', async () => {
      const c = client();
      const body = { email: email('rl'), password: 'wrong-password' };
      for (let i = 0; i < 10; i++) {
        const res = await c.web('/auth/login').send(body);
        expect(res.status).toBe(401);
      }
      const limited = await c.web('/auth/login').send(body);
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
      expect(limited.headers['retry-after']).toBeDefined();

      // Another client address is not affected.
      const other = await client().web('/auth/login').send(body);
      expect(other.status).toBe(401);
    });

    it('limits register to 5 per minute', async () => {
      const c = client();
      for (let i = 0; i < 5; i++) {
        const res = await c
          .web('/auth/register')
          .send({ email: email(`rr${i}`), password: PASSWORD });
        expect(res.status).toBe(201);
      }
      const limited = await c
        .web('/auth/register')
        .send({ email: email('rr-over'), password: PASSWORD });
      expect(limited.status).toBe(429);
      expect(limited.body.error.code).toBe('RATE_LIMITED');
    });
  });
});
