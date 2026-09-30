import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { MailModule } from '../mail/mail.module.js';
import { UsersModule } from '../users/users.module.js';
import { AccessTokenService } from './access-token.service.js';
import { AuthController, AuthProvidersController, MeController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTokenService } from './email-token.service.js';
import { GoogleAuthLibraryVerifier, GoogleIdTokenVerifier } from './google-id-token-verifier.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PasswordService } from './password.service.js';
import { RefreshTokenService } from './refresh-token.service.js';

@Module({
  imports: [
    UsersModule,
    MailModule,
    // Fallback limit for routes without their own `@Throttle` (logout); the auth routes override it.
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 60 }] }),
  ],
  controllers: [AuthController, AuthProvidersController, MeController],
  providers: [
    AuthService,
    PasswordService,
    AccessTokenService,
    RefreshTokenService,
    EmailTokenService,
    { provide: GoogleIdTokenVerifier, useClass: GoogleAuthLibraryVerifier },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AccessTokenService, AuthService, PasswordService],
})
export class AuthModule {}
