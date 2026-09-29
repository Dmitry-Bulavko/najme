import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@najme/contracts';

/** Throwable that the global filter renders as `{ error: { code, message } }`. */
export function apiError(status: number, code: ErrorCode, message: string): HttpException {
  return new HttpException({ code, message }, status);
}
