import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type EmailTokenPurpose = 'VERIFY_EMAIL' | 'RESET_PASSWORD';

const HOUR_MS = 3_600_000;
/** Keep in step with `EMAIL_TOKEN_TTL_HOURS` in `mail/email-templates.ts` (quoted in the emails). */
export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * HOUR_MS,
  RESET_PASSWORD: HOUR_MS,
};

export function hashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Single-use, expiring tokens sent by email (verify address, reset password). Same scheme as
 * refresh tokens (ADR-0010): 32 random bytes as base64url, only the SHA-256 is stored.
 */
@Injectable()
export class EmailTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Issues a token and returns the raw value (never stored). Unused tokens of the same purpose for
   * the user are invalidated, so only the newest link works (this is what "resend" relies on).
   */
  async issue(userId: string, purpose: EmailTokenPurpose): Promise<string> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.emailToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
      this.prisma.emailToken.create({
        data: {
          id: newId(),
          userId,
          purpose,
          tokenHash: hashEmailToken(raw),
          expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS[purpose]),
        },
      }),
    ]);
    return raw;
  }

  /**
   * Atomically claims the token and runs `apply` in the same transaction; if `apply` throws, the
   * claim is rolled back and the token stays usable. The claim is a conditional update
   * (`used_at IS NULL AND expires_at > now`), so of two concurrent requests only one wins.
   *
   * @throws HttpException 400 `TOKEN_EXPIRED` for an expired token, 400 `TOKEN_INVALID` for an
   * unknown, already used or wrong-purpose one.
   */
  async consume(
    presented: string,
    purpose: EmailTokenPurpose,
    apply: (userId: string, tx: Prisma.TransactionClient) => Promise<void>,
  ): Promise<void> {
    const tokenHash = hashEmailToken(presented);
    const claimed = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const rows = await tx.emailToken.updateManyAndReturn({
        where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
        select: { userId: true },
      });
      const userId = rows[0]?.userId;
      if (userId === undefined) return false;
      await apply(userId, tx);
      return true;
    });
    if (claimed) return;

    const existing = await this.prisma.emailToken.findUnique({
      where: { tokenHash },
      select: { purpose: true, usedAt: true },
    });
    if (existing && existing.purpose === purpose && existing.usedAt === null) {
      throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_EXPIRED', 'This link has expired.');
    }
    throw apiError(
      HttpStatus.BAD_REQUEST,
      'TOKEN_INVALID',
      'This link is invalid or was already used.',
    );
  }
}
