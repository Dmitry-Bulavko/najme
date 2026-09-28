import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiErrorResponse } from '@najme/contracts';

const DEFAULT_CODES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

/**
 * Maps every uncaught error to the `ApiError` envelope from `@najme/contracts`
 * (docs/conventions/api.md). Never logs the raw error for client (4xx) responses to keep expected
 * validation noise out of the logs; 5xx responses are logged with context but without request
 * bodies (no secrets, ADR-0002).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.toApiError(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json(body);
  }

  private toApiError(exception: unknown): { status: number; body: ApiErrorResponse } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      if (isApiErrorShape(payload)) {
        return { status, body: { error: payload } };
      }

      const message = typeof payload === 'string' ? payload : exception.message;
      const code = DEFAULT_CODES[status] ?? 'HTTP_ERROR';
      return { status, body: { error: { code, message } } };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } },
    };
  }
}

function isApiErrorShape(value: unknown): value is ApiErrorResponse['error'] {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as { code: unknown }).code === 'string' &&
    typeof (value as { message: unknown }).message === 'string'
  );
}
