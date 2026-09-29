import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { apiError } from '../common/errors/api-error.js';
import { newId } from '../common/id.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ClientContext } from './auth.types.js';
import { REFRESH_TOKEN_TTL_MS } from './refresh-cookie.js';

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

const MAX_USER_AGENT_LENGTH = 512;

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a new refresh token for the user and returns the raw value (never stored). */
  async issue(userId: string, context: ClientContext): Promise<string> {
    const raw = generateRefreshToken();
    await this.prisma.refreshToken.create({
      data: this.row(newId(), userId, raw, context),
    });
    return raw;
  }

  /**
   * Exchanges a refresh token for a fresh one and revokes the presented one (rotation).
   * Presenting a token that is already rotated or revoked is treated as theft: every active
   * refresh token of that user is revoked (ADR-0010).
   *
   * `prepare` runs after the token is validated but before it is rotated, so a failing lookup
   * (e.g. a transient DB error) cannot lose the freshly issued token. Returning false means the
   * account is gone: all its tokens are revoked and the request is rejected.
   *
   * @throws HttpException 401 `UNAUTHENTICATED` for unknown/expired tokens, 401
   * `REFRESH_TOKEN_REUSED` on reuse.
   */
  async rotate(
    presented: string,
    context: ClientContext,
    prepare: (userId: string) => Promise<boolean>,
  ): Promise<{ userId: string; refreshToken: string }> {
    const current = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(presented) },
    });
    if (!current) throw this.unauthenticated();
    if (current.revokedAt) return this.reuse(current.userId);
    if (current.expiresAt.getTime() <= Date.now()) throw this.unauthenticated();
    if (!(await prepare(current.userId))) {
      await this.revokeAllForUser(current.userId);
      throw this.unauthenticated();
    }

    const nextRaw = generateRefreshToken();
    const nextId = newId();
    const rotated = await this.prisma.$transaction(async (tx) => {
      // The conditional update is the atomic claim: of two concurrent rotations only one wins.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: current.id, revokedAt: null },
        data: { revokedAt: new Date(), replacedByTokenId: nextId },
      });
      if (claimed.count === 0) return false;
      await tx.refreshToken.create({ data: this.row(nextId, current.userId, nextRaw, context) });
      return true;
    });
    if (!rotated) return this.reuse(current.userId);
    return { userId: current.userId, refreshToken: nextRaw };
  }

  /** Revokes one token; unknown or already revoked tokens are ignored (logout is idempotent). */
  async revoke(presented: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(presented), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async reuse(userId: string): Promise<never> {
    await this.revokeAllForUser(userId);
    throw apiError(
      HttpStatus.UNAUTHORIZED,
      'REFRESH_TOKEN_REUSED',
      'The refresh token was already used; please sign in again.',
    );
  }

  private unauthenticated(): Error {
    return apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'The refresh token is invalid.');
  }

  private row(id: string, userId: string, raw: string, context: ClientContext) {
    return {
      id,
      userId,
      tokenHash: hashRefreshToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: context.userAgent?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
      ipAddress: context.ipAddress,
    };
  }
}
