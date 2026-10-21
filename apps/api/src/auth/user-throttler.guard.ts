import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit tracker keyed by authenticated user id (ADR-0013 create-business AC).
 * Falls back to the default IP tracker when no user is present.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    if (typeof user?.id === 'string' && user.id.length > 0) {
      return `user:${user.id}`;
    }
    return super.getTracker(req);
  }
}
