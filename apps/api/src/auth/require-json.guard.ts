import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { apiError } from '../common/errors/api-error.js';

const JSON_CONTENT_TYPE = /^application\/json\s*(;|$)/i;

/**
 * CSRF defence in depth (ADR-0010): state-changing auth endpoints only accept
 * `Content-Type: application/json`, which a cross-site HTML form cannot send.
 */
@Injectable()
export class RequireJsonGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!JSON_CONTENT_TYPE.test(request.headers['content-type'] ?? '')) {
      throw apiError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'HTTP_ERROR',
        'Content-Type must be application/json.',
      );
    }
    return true;
  }
}
