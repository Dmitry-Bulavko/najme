import { describe, expect, it } from 'vitest';
import { envSchema } from './env.schema.js';

const base = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
  MAIL_FROM: 'Najme <no-reply@najme.test>',
  APP_WEB_URL: 'http://localhost:3001/',
};

describe('envSchema mail settings', () => {
  it('parses the SMTP port and strips the trailing slash of APP_WEB_URL', () => {
    const env = envSchema.parse(base);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.APP_WEB_URL).toBe('http://localhost:3001');
    expect(env.SMTP_USER).toBeUndefined();
  });

  it.each(['SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'APP_WEB_URL'])('requires %s', (key) => {
    const { [key as keyof typeof base]: _omitted, ...rest } = base;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it('requires SMTP_USER and SMTP_PASSWORD together', () => {
    expect(envSchema.safeParse({ ...base, SMTP_USER: 'u' }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, SMTP_USER: 'u', SMTP_PASSWORD: 'p' }).success).toBe(true);
  });
});
