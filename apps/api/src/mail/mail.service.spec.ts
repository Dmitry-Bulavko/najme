import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.schema.js';
import { MailService, describeFailure } from './mail.service.js';
import type { Mailer } from './mailer.js';

const env = { APP_WEB_URL: 'http://localhost:3001' } as Env;

describe('MailService.defer logging', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never logs the error message, which may contain an email address', async () => {
    const logged: string[] = [];
    vi.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
    const service = new MailService({} as Mailer, env);
    const error = Object.assign(
      new Error(
        'Invalid `findFirst()` where email: "victim@example.com"; 550 <victim@example.com>',
      ),
      { code: 'P2010' },
    );

    service.defer('resetPassword', null, () => Promise.reject(error));
    service.defer('verifyEmail', 'user-1', () => Promise.reject(error));
    await service.idle();

    expect(logged).toHaveLength(2);
    for (const line of logged) expect(line).not.toContain('victim@example.com');
    expect(logged[0]).toBe('Email job failed: kind=resetPassword error=Error code=P2010');
    expect(logged[1]).toBe('Email job failed: kind=verifyEmail user=user-1 error=Error code=P2010');
  });

  it('describes non-Error rejections without their content', () => {
    expect(describeFailure('verifyEmail', null, 'a@b.io')).toBe(
      'Email job failed: kind=verifyEmail error=string',
    );
  });
});
