import 'reflect-metadata';
import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  EmailAlreadyRegisteredError,
  IdentityConflictError,
  UnverifiedProviderEmailError,
} from '../../users/users.errors.js';
import { ApiExceptionFilter } from './api-exception.filter.js';

function run(exception: unknown): { status: number; body: unknown } {
  const json = vi.fn((_body: unknown) => undefined);
  const status = vi.fn((_code: number) => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as Parameters<ApiExceptionFilter['catch']>[1];
  new ApiExceptionFilter().catch(exception, host);
  return { status: status.mock.calls[0]?.[0] as number, body: json.mock.calls[0]?.[0] };
}

const codeOf = (result: { body: unknown }): unknown =>
  (result.body as { error: { code: string } }).error.code;

describe('ApiExceptionFilter', () => {
  it.each([
    [HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED'],
    [HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED'],
    [HttpStatus.FORBIDDEN, 'FORBIDDEN'],
    [HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    [HttpStatus.CONFLICT, 'CONFLICT'],
    [HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED'],
    [HttpStatus.I_AM_A_TEAPOT, 'HTTP_ERROR'],
  ])('maps a plain %i to %s', (status, code) => {
    const result = run(new HttpException('x', status));
    expect(result.status).toBe(status);
    expect(codeOf(result)).toBe(code);
  });

  it('keeps an explicit ApiError code', () => {
    const result = run(new HttpException({ code: 'INVALID_CREDENTIALS', message: 'm' }, 401));
    expect(codeOf(result)).toBe('INVALID_CREDENTIALS');
  });

  it('maps unverified provider emails to 401 GOOGLE_TOKEN_INVALID', () => {
    const result = run(new UnverifiedProviderEmailError());
    expect(result.status).toBe(401);
    expect(codeOf(result)).toBe('GOOGLE_TOKEN_INVALID');
  });

  it.each([new IdentityConflictError(), new EmailAlreadyRegisteredError()])(
    'maps %s to a generic 409 CONFLICT (no email enumeration)',
    (error) => {
      const result = run(error);
      expect(result.status).toBe(409);
      expect(codeOf(result)).toBe('CONFLICT');
    },
  );

  it('maps unknown errors to 500 INTERNAL_ERROR', () => {
    const result = run(new Error('boom'));
    expect(result.status).toBe(500);
    expect(codeOf(result)).toBe('INTERNAL_ERROR');
  });
});
