import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Validates a request payload (body, query or params) against a zod schema and returns the parsed,
 * typed value. On failure it throws a `BadRequestException` whose response body already matches the
 * `VALIDATION_FAILED` shape expected by the global exception filter (docs/conventions/api.md).
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed.',
        details: { issues: result.error.issues },
      });
    }
    return result.data;
  }
}
