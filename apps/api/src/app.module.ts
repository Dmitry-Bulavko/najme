import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ServicesModule } from './services/services.module.js';
import { StaffModule } from './staff/staff.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadsModule } from './storage/uploads.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    HealthModule,
    CategoriesModule,
    UsersModule,
    MailModule,
    AuthModule,
    StorageModule,
    BusinessesModule,
    InvitationsModule,
    StaffModule,
    ServicesModule,
    ScheduleModule,
    UploadsModule,
  ],
})
export class AppModule {}
