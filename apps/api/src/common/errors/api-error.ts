import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@najme/contracts';

/** Throwable that the global filter renders as `{ error: { code, message, details? } }`. */
export function apiError(
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): HttpException {
  return new HttpException(
    details === undefined ? { code, message } : { code, message, details },
    status,
  );
}
