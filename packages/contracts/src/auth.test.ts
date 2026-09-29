import { describe, expect, it } from 'vitest';

import {
  authSessionSchema,
  forgotPasswordRequestSchema,
  googleSignInRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  verifyEmailRequestSchema,
} from './auth.js';
import { ERROR_CODES, errorCodeSchema } from './error.js';
import { changePasswordRequestSchema, meSchema, updateProfileRequestSchema } from './users.js';

const me = {
  id: 'u1',
  email: 'a@b.co',
  emailVerified: false,
  displayName: null,
  avatarUrl: null,
  locale: 'en',
  hasPassword: true,
};

describe('registerRequestSchema', () => {
  it('trims and lowercases the email', () => {
    const r = registerRequestSchema.parse({ email: '  Foo@Example.COM ', password: 'password1' });
    expect(r.email).toBe('foo@example.com');
  });

  it('accepts optional displayName and locale', () => {
    expect(
      registerRequestSchema.safeParse({
        email: 'a@b.co',
        password: 'password1',
        displayName: 'Ana',
        locale: 'me',
      }).success,
    ).toBe(true);
  });

  it('enforces password bounds 8-128', () => {
    const base = { email: 'a@b.co' };
    expect(registerRequestSchema.safeParse({ ...base, password: 'a'.repeat(7) }).success).toBe(
      false,
    );
    expect(registerRequestSchema.safeParse({ ...base, password: 'a'.repeat(8) }).success).toBe(
      true,
    );
    expect(registerRequestSchema.safeParse({ ...base, password: 'a'.repeat(128) }).success).toBe(
      true,
    );
    expect(registerRequestSchema.safeParse({ ...base, password: 'a'.repeat(129) }).success).toBe(
      false,
    );
  });

  it('rejects invalid email and unknown locale', () => {
    expect(registerRequestSchema.safeParse({ email: 'nope', password: 'password1' }).success).toBe(
      false,
    );
    expect(
      registerRequestSchema.safeParse({ email: 'a@b.co', password: 'password1', locale: 'de' })
        .success,
    ).toBe(false);
  });
});

describe('loginRequestSchema', () => {
  it('normalises email and requires a password', () => {
    expect(loginRequestSchema.parse({ email: ' A@B.co ', password: 'x' }).email).toBe('a@b.co');
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('refreshRequestSchema', () => {
  it('accepts an empty body and a mobile token', () => {
    expect(refreshRequestSchema.safeParse({}).success).toBe(true);
    expect(refreshRequestSchema.safeParse({ refreshToken: 'abc' }).success).toBe(true);
    expect(refreshRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });
});

describe('other auth requests', () => {
  it('googleSignInRequest requires idToken', () => {
    expect(googleSignInRequestSchema.safeParse({ idToken: 't', locale: 'ru' }).success).toBe(true);
    expect(googleSignInRequestSchema.safeParse({}).success).toBe(false);
  });

  it('verifyEmailRequest requires token', () => {
    expect(verifyEmailRequestSchema.safeParse({ token: 't' }).success).toBe(true);
    expect(verifyEmailRequestSchema.safeParse({ token: '' }).success).toBe(false);
  });

  it('forgotPasswordRequest normalises email', () => {
    expect(forgotPasswordRequestSchema.parse({ email: 'X@Y.io' }).email).toBe('x@y.io');
  });

  it('resetPasswordRequest validates newPassword bounds', () => {
    expect(resetPasswordRequestSchema.safeParse({ token: 't', newPassword: 'short' }).success).toBe(
      false,
    );
    expect(
      resetPasswordRequestSchema.safeParse({ token: 't', newPassword: 'longenough' }).success,
    ).toBe(true);
  });
});

describe('authSessionSchema and meSchema', () => {
  it('accepts a web session without refreshToken', () => {
    const r = authSessionSchema.safeParse({
      accessToken: 'jwt',
      accessTokenExpiresAt: '2026-01-01T00:00:00.000Z',
      user: me,
    });
    expect(r.success).toBe(true);
  });

  it('accepts a mobile session with refreshToken', () => {
    expect(
      authSessionSchema.safeParse({
        accessToken: 'jwt',
        accessTokenExpiresAt: '2026-01-01T00:00:00Z',
        refreshToken: 'r',
        user: me,
      }).success,
    ).toBe(true);
  });

  it('rejects a non-ISO expiry', () => {
    expect(
      authSessionSchema.safeParse({
        accessToken: 'jwt',
        accessTokenExpiresAt: 'tomorrow',
        user: me,
      }).success,
    ).toBe(false);
  });

  it('me rejects missing fields', () => {
    expect(meSchema.safeParse({ ...me, hasPassword: undefined }).success).toBe(false);
  });
});

describe('updateProfileRequestSchema', () => {
  it('requires at least one field', () => {
    expect(updateProfileRequestSchema.safeParse({}).success).toBe(false);
  });

  it('accepts either field', () => {
    expect(updateProfileRequestSchema.safeParse({ displayName: ' Ana ' }).data).toEqual({
      displayName: 'Ana',
    });
    expect(updateProfileRequestSchema.safeParse({ locale: 'tr' }).success).toBe(true);
  });

  it('rejects an empty displayName and bad locale', () => {
    expect(updateProfileRequestSchema.safeParse({ displayName: '  ' }).success).toBe(false);
    expect(updateProfileRequestSchema.safeParse({ locale: 'xx' }).success).toBe(false);
  });
});

describe('changePasswordRequestSchema', () => {
  it('validates newPassword bounds', () => {
    expect(
      changePasswordRequestSchema.safeParse({ currentPassword: 'old', newPassword: 'short' })
        .success,
    ).toBe(false);
    expect(
      changePasswordRequestSchema.safeParse({ currentPassword: 'old', newPassword: 'longenough' })
        .success,
    ).toBe(true);
  });
});

describe('error codes', () => {
  it('include the new auth codes', () => {
    for (const code of [
      'EMAIL_TAKEN',
      'REFRESH_TOKEN_REUSED',
      'GOOGLE_TOKEN_INVALID',
      'RATE_LIMITED',
    ]) {
      expect(errorCodeSchema.safeParse(code).success).toBe(true);
    }
    expect(errorCodeSchema.safeParse('NOPE').success).toBe(false);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });
});
