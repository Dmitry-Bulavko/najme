import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  VerifyEmailRequest,
} from '@najme/contracts';
import { resolveLocale } from '@najme/i18n';
import { MailService } from '../mail/mail.service.js';
import { apiError } from '../common/errors/api-error.js';
import { toMe } from '../users/me.mapper.js';
import { EmailAlreadyRegisteredError } from '../users/users.errors.js';
import type { User } from '../users/users.types.js';
import { UsersService } from '../users/users.service.js';
import { AccessTokenService } from './access-token.service.js';
import type { ClientContext, IssuedSession } from './auth.types.js';
import { EmailTokenService, type EmailTokenPurpose } from './email-token.service.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly emailTokens: EmailTokenService,
    private readonly mail: MailService,
  ) {}

  /** @param locale already resolved: the request's `locale`, else from `Accept-Language`. */
  async register(
    input: RegisterRequest,
    locale: NonNullable<RegisterRequest['locale']>,
    context: ClientContext,
  ): Promise<IssuedSession> {
    const passwordHash = await this.passwords.hash(input.password);
    let user: User;
    try {
      user = await this.users.createWithPassword({
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        localePreference: locale,
      });
    } catch (error) {
      // The only place where a taken email is revealed, as the contract requires (409 EMAIL_TAKEN).
      if (error instanceof EmailAlreadyRegisteredError) {
        throw apiError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'This email is already registered.');
      }
      throw error;
    }
    this.sendEmail('verifyEmail', user);
    return this.startSession(user, true, context);
  }

  async login(input: LoginRequest, context: ClientContext): Promise<IssuedSession> {
    const credential = await this.users.findPasswordCredentialByEmail(input.email);
    // Unknown email, wrong password and password-less accounts are indistinguishable, in the
    // response and in timing (a dummy hash is verified when there is nothing to compare against).
    const valid = credential
      ? await this.passwords.verify(credential.passwordHash, input.password)
      : await this.passwords.verifyDummy(input.password);
    if (!credential || !valid) {
      throw apiError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'The email or password is incorrect.',
      );
    }
    return this.startSession(credential.user, true, context);
  }

  async refresh(presented: string | undefined, context: ClientContext): Promise<IssuedSession> {
    if (!presented) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'The refresh token is missing.');
    }
    let account: { user: User; hasPassword: boolean } | undefined;
    const { refreshToken } = await this.refreshTokens.rotate(presented, context, async (userId) => {
      const user = await this.users.findById(userId);
      if (!user) return false;
      account = { user, hasPassword: await this.users.hasPassword(userId) };
      return true;
    });
    // `prepare` returned true, so the account is set.
    return this.buildSession(account!.user, account!.hasPassword, refreshToken);
  }

  async logout(presented: string | undefined): Promise<void> {
    if (presented) await this.refreshTokens.revoke(presented);
  }

  async me(userId: string): Promise<ReturnType<typeof toMe>> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    return toMe(user, await this.users.hasPassword(userId));
  }

  /** Sets `emailVerifiedAt`. The token is single-use; 400 `TOKEN_INVALID`/`TOKEN_EXPIRED`. */
  async verifyEmail(input: VerifyEmailRequest): Promise<void> {
    await this.emailTokens.consume(input.token, 'VERIFY_EMAIL', (userId, tx) =>
      this.users.markEmailVerified(userId, tx),
    );
  }

  /** Sends a fresh verification link (older unused ones stop working). No-op once verified. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw apiError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication is required.');
    }
    if (user.emailVerifiedAt === null) this.sendEmail('verifyEmail', user);
  }

  /**
   * Never reveals whether the account exists: the lookup, token and email all happen in the
   * background, so the response is identical in content and (roughly) in timing.
   */
  forgotPassword(input: ForgotPasswordRequest): void {
    this.mail.defer('resetPassword', null, async () => {
      const credential = await this.users.findPasswordCredentialByEmail(input.email);
      if (credential) await this.issueAndSend('resetPassword', credential.user);
    });
  }

  /** Sets the new password and signs the user out everywhere (all refresh tokens revoked). */
  async resetPassword(input: ResetPasswordRequest): Promise<void> {
    const passwordHash = await this.passwords.hash(input.newPassword);
    await this.emailTokens.consume(input.token, 'RESET_PASSWORD', async (userId, tx) => {
      // Rolls back the token claim too when the account has no password identity any more.
      if (!(await this.users.setPassword(userId, passwordHash, tx))) {
        throw apiError(HttpStatus.BAD_REQUEST, 'TOKEN_INVALID', 'This link is invalid.');
      }
      await this.refreshTokens.revokeAllForUser(userId, tx);
      // The link only reached the mailbox owner, so this proves ownership of the address.
      await this.users.markEmailVerified(userId, tx);
    });
  }

  private sendEmail(kind: 'verifyEmail' | 'resetPassword', user: User): void {
    this.mail.defer(kind, user.id, () => this.issueAndSend(kind, user));
  }

  private async issueAndSend(kind: 'verifyEmail' | 'resetPassword', user: User): Promise<void> {
    const purpose: EmailTokenPurpose = kind === 'verifyEmail' ? 'VERIFY_EMAIL' : 'RESET_PASSWORD';
    const token = await this.emailTokens.issue(user.id, purpose);
    await this.mail.send(
      kind,
      {
        userId: user.id,
        email: user.email,
        locale: resolveLocale([user.localePreference]),
      },
      token,
    );
  }

  private async startSession(
    user: User,
    hasPassword: boolean,
    context: ClientContext,
  ): Promise<IssuedSession> {
    const refreshToken = await this.refreshTokens.issue(user.id, context);
    return this.buildSession(user, hasPassword, refreshToken);
  }

  private async buildSession(
    user: User,
    hasPassword: boolean,
    refreshToken: string,
  ): Promise<IssuedSession> {
    const access = await this.accessTokens.sign(user.id);
    return {
      accessToken: access.token,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshToken,
      user: toMe(user, hasPassword),
    };
  }
}
