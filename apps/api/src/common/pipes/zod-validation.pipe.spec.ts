import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';
import { ApiExceptionFilter } from '../filters/api-exception.filter.js';

const schema = z.object({
  name: z.string().min(1),
  age: z.coerce.number().int().positive(),
});

describe('ZodValidationPipe', () => {
  it('returns the parsed (coerced) value when the input is valid', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(pipe.transform({ name: 'Ana', age: '30' })).toEqual({ name: 'Ana', age: 30 });
  });

  it('throws a BadRequestException with the VALIDATION_FAILED shape when the input is invalid', () => {
    const pipe = new ZodValidationPipe(schema);

    try {
      pipe.transform({ name: '', age: -1 });
      expect.unreachable('transform should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(response).toMatchObject({
        code: 'VALIDATION_FAILED',
        message: expect.any(String),
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: ['name'] }),
            expect.objectContaining({ path: ['age'] }),
          ]),
        },
      });
    }
  });

  it('produces the final ApiError envelope once passed through the global exception filter', () => {
    const pipe = new ZodValidationPipe(schema);
    const filter = new ApiExceptionFilter();
    const json = vi.fn();
    const response = { status: vi.fn(() => ({ json })) };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as Parameters<ApiExceptionFilter['catch']>[1];

    try {
      pipe.transform({ name: '', age: -1 });
    } catch (error) {
      filter.catch(error, host);
    }

    expect(response.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_FAILED',
        message: expect.any(String),
        details: {
          issues: expect.arrayContaining([
            expect.objectContaining({ path: ['name'] }),
            expect.objectContaining({ path: ['age'] }),
          ]),
        },
      },
    });
  });
});
