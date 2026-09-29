import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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
  loginRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  type AuthSession,
  type LoginRequest,
  type Me,
  type RegisterRequest,
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
const REFRESH_LIMIT = { default: { limit: 30, ttl: MINUTE_MS } };

function clientContext(req: Request): ClientContext {
  return { userAgent: req.header('user-agent') ?? null, ipAddress: req.ip ?? null };
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
      // A rejected refresh token is dead either way; do not keep sending it.
      if (!isMobileClient(req)) clearRefreshCookie(res, this.env.AUTH_COOKIE_SECURE);
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

  /** Web reads the httpOnly cookie, mobile the body (ADR-0010). */
  private presentedToken(req: Request, body: unknown): string | undefined {
    if (isMobileClient(req)) {
      const parsed = this.bodyParser.transform(body ?? {}) as { refreshToken?: string };
      return parsed.refreshToken;
    }
    return readRefreshCookie(req);
  }

  private deliver(req: Request, res: Response, session: IssuedSession): AuthSession {
    const { refreshToken, ...rest } = session;
    if (isMobileClient(req)) return { ...rest, refreshToken };
    setRefreshCookie(res, refreshToken, this.env.AUTH_COOKIE_SECURE);
    return rest;
  }
}

@ApiTags('users')
@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @ApiOperation({ summary: 'The signed-in user' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.auth.me(user.id);
  }
}
