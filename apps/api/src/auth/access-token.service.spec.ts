import 'reflect-metadata';
import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import type { Env } from '../config/env.schema.js';
import { AccessTokenService } from './access-token.service.js';

const SECRET = 'unit-test-secret-0123456789abcdef0123';
const key = (secret: string): Uint8Array => new TextEncoder().encode(secret);
const service = new AccessTokenService({ JWT_ACCESS_SECRET: SECRET } as Env);

interface Overrides {
  alg?: string;
  secret?: string;
  sub?: string | null;
  iss?: string;
  aud?: string;
  exp?: number;
}

function build(o: Overrides = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  let jwt = new SignJWT({})
    .setProtectedHeader({ alg: o.alg ?? 'HS256' })
    .setIssuer(o.iss ?? 'najme')
    .setAudience(o.aud ?? 'najme-api')
    .setIssuedAt(now)
    .setExpirationTime(o.exp ?? now + 600);
  if (o.sub !== null) jwt = jwt.setSubject(o.sub ?? 'user-1');
  return jwt.sign(key(o.secret ?? SECRET));
}

const b64 = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('AccessTokenService', () => {
  it('round-trips a signed token to the user id', async () => {
    const { token, expiresAt } = await service.sign('user-42');
    expect(await service.verify(token)).toBe('user-42');
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('accepts a hand-built valid token', async () => {
    expect(await service.verify(await build())).toBe('user-1');
  });

  it('rejects an expired token', async () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    expect(await service.verify(await build({ exp: past }))).toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    expect(
      await service.verify(await build({ secret: 'another-secret-0123456789abcdef012345' })),
    ).toBeNull();
  });

  it('rejects alg none', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { sub: 'user-1', iss: 'najme', aud: 'najme-api', iat: now, exp: now + 600 };
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
    expect(await service.verify(token)).toBeNull();
  });

  it('rejects HS384 even with the right secret', async () => {
    expect(await service.verify(await build({ alg: 'HS384' }))).toBeNull();
  });

  it('rejects a wrong issuer or audience', async () => {
    expect(await service.verify(await build({ iss: 'evil' }))).toBeNull();
    expect(await service.verify(await build({ aud: 'other-api' }))).toBeNull();
  });

  it('rejects a missing or empty subject', async () => {
    expect(await service.verify(await build({ sub: null }))).toBeNull();
    expect(await service.verify(await build({ sub: '' }))).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await service.verify('not-a-jwt')).toBeNull();
    expect(await service.verify('')).toBeNull();
  });
});
