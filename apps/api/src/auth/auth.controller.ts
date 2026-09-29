import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { parseAcceptLanguage, resolveLocale } from '@najme/i18n';
import {
  changePasswordRequestSchema,
  forgotPasswordRequestSchema,
  googleSignInRequestSchema,
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  updateProfileRequestSchema,
  verifyEmailRequestSchema,
  type AuthProviders,
  type AuthSession,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type GoogleSignInRequest,
  type LoginRequest,
  type Me,
  type RegisterRequest,
  type ResetPasswordRequest,
  type UpdateProfileRequest,
  type VerifyEmailRequest,
} from '@najme/contracts';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { Env } from '../config/env.schema.js';
import { ENV } from '../config/env.token.js';
import type { AuthenticatedUser, ClientContext, IssuedSession } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import {
  clearRefreshCookie,
  isMobileClient,
  readRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie.js';
import { RequireJsonGuard } from './require-json.guard.js';

const MINUTE_MS = 60_000;
// Per client IP and route, in memory (single API instance, ADR-0007).
const REGISTER_LIMIT = { default: { limit: 5, ttl: MINUTE_MS } };
const LOGIN_LIMIT = { default: { limit: 10, ttl: MINUTE_MS } };
const GOOGLE_LIMIT = { default: { limit: 10, ttl: MINUTE_MS } };
const PROVIDERS_LIMIT = { default: { limit: 60, ttl: MINUTE_MS } };
const REFRESH_LIMIT = { default: { limit: 30, ttl: MINUTE_MS } };
const VERIFY_LIMIT = { default: { limit: 10, ttl: MINUTE_MS } };
const RESEND_LIMIT = { default: { limit: 3, ttl: MINUTE_MS } };
const FORGOT_LIMIT = { default: { limit: 5, ttl: MINUTE_MS } };
const RESET_LIMIT = { default: { limit: 10, ttl: MINUTE_MS } };
const CHANGE_PASSWORD_LIMIT = { default: { limit: 5, ttl: MINUTE_MS } };

function clientContext(req: Request): ClientContext {
  return { userAgent: req.header('user-agent') ?? null, ipAddress: req.ip ?? null };
}

/** Web gets the refresh token as httpOnly cookie, mobile in the body (ADR-0010). */
function deliverSession(
  req: Request,
  res: Response,
  session: IssuedSession,
  cookieSecure: boolean,
): AuthSession {
  const { refreshToken, ...rest } = session;
  if (isMobileClient(req)) return { ...rest, refreshToken };
  setRefreshCookie(res, refreshToken, cookieSecure);
  return rest;
}

@ApiTags('auth')
@Public()
@UseGuards(ThrottlerGuard, RequireJsonGuard)
@Controller('auth')
export class AuthController {
  private readonly bodyParser = new ZodValidationPipe(refreshRequestSchema);

  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  @Throttle(REGISTER_LIMIT)
  @ApiOperation({ summary: 'Create an account with email and password' })
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const locale =
      body.locale ?? resolveLocale(parseAcceptLanguage(req.header('accept-language') ?? ''));
    return this.deliver(req, res, await this.auth.register(body, locale, clientContext(req)));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(LOGIN_LIMIT)
  @ApiOperation({ summary: 'Sign in with email and password' })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    return this.deliver(req, res, await this.auth.login(body, clientContext(req)));
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle(GOOGLE_LIMIT)
  @ApiOperation({ summary: 'Sign in (or sign up) with a Google ID token' })
  async google(
    @Body(new ZodValidationPipe(googleSignInRequestSchema)) body: GoogleSignInRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const locale =
      body.locale ?? resolveLocale(parseAcceptLanguage(req.header('accept-language') ?? ''));
    return this.deliver(req, res, await this.auth.googleSignIn(body, locale, clientContext(req)));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(REFRESH_LIMIT)
  @ApiOperation({ summary: 'Rotate the refresh token and get a new access token' })
  async refresh(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    try {
      const presented = this.presentedToken(req, body);
      return this.deliver(req, res, await this.auth.refresh(presented, clientContext(req)));
    } catch (error) {
      // A rejected refresh token is dead either way; do not keep sending it. A transient failure
      // (5xx) leaves the cookie alone so the client can retry.
      if (
        !isMobileClient(req) &&
        error instanceof HttpException &&
        error.getStatus() === HttpStatus.UNAUTHORIZED
      ) {
        clearRefreshCookie(res, this.env.AUTH_COOKIE_SECURE);
      }
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh token' })
  async logout(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.presentedToken(req, body));
    clearRefreshCookie(res, this.env.AUTH_COOKIE_SECURE);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(VERIFY_LIMIT)
  @ApiOperation({ summary: 'Confirm the email address with the emailed token' })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailRequestSchema)) body: VerifyEmailRequest,
  ): Promise<void> {
    await this.auth.verifyEmail(body);
  }

  @Post('verify-email/resend')
  @Public(false)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(RESEND_LIMIT)
  @ApiOperation({ summary: 'Send the verification email again (signed-in user)' })
  async resendVerification(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.resendVerification(user.id);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(FORGOT_LIMIT)
  @ApiOperation({ summary: 'Email a password reset link (always 202, never reveals the account)' })
  forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordRequestSchema)) body: ForgotPasswordRequest,
  ): void {
    this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(RESET_LIMIT)
  @ApiOperation({ summary: 'Set a new password with the emailed token; revokes all sessions' })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordRequestSchema)) body: ResetPasswordRequest,
  ): Promise<void> {
    await this.auth.resetPassword(body);
  }

  /** Web reads the httpOnly cookie, mobile the body (ADR-0010). */
  private presentedToken(req: Request, body: unknown): string | undefined {
    if (isMobileClient(req)) {
      const parsed = this.bodyParser.transform(body ?? {}) as { refreshToken?: string };
      return parsed.refreshToken;
    }
    return readRefreshCookie(req);
  }

  private deliver(req: Request, res: Response, session: IssuedSession): AuthSession {
    return deliverSession(req, res, session, this.env.AUTH_COOKIE_SECURE);
  }
}

/** Separate from `AuthController` because that one requires a JSON body (`RequireJsonGuard`). */
@ApiTags('auth')
@Public()
@UseGuards(ThrottlerGuard)
@Controller('auth/providers')
export class AuthProvidersController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @Throttle(PROVIDERS_LIMIT)
  @ApiOperation({ summary: 'Which optional sign-in methods are enabled' })
  providers(): AuthProviders {
    return this.auth.providers();
  }
}

@ApiTags('users')
@Controller('me')
export class MeController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.auth.me(user.id);
  }

  @Patch()
  @UseGuards(ThrottlerGuard, RequireJsonGuard)
  @ApiOperation({ summary: 'Update display name and/or account language' })
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<Me> {
    return this.auth.updateProfile(user.id, body);
  }

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard, RequireJsonGuard)
  @Throttle(CHANGE_PASSWORD_LIMIT)
  @ApiOperation({
    summary: 'Change the password; ends all sessions and returns a fresh one for the caller',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthSession> {
    const session = await this.auth.changePassword(user.id, body, clientContext(req));
    return deliverSession(req, res, session, this.env.AUTH_COOKIE_SECURE);
  }
}
