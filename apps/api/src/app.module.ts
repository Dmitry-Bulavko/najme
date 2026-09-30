import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { BusinessesModule } from './businesses/businesses.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './health/health.module.js';
import { MailModule } from './mail/mail.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ServicesModule } from './services/services.module.js';
import { StaffModule } from './staff/staff.module.js';
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
    BusinessesModule,
    StaffModule,
    ServicesModule,
    ScheduleModule,
  ],
})
export class AppModule {}
