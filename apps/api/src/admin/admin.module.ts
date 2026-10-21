import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { AdminBusinessesController } from './admin-businesses.controller.js';
import { AdminBusinessesService } from './admin-businesses.service.js';
import { PlatformAdminGuard } from './platform-admin.guard.js';

@Module({
  imports: [BusinessesModule],
  controllers: [AdminBusinessesController],
  providers: [AdminBusinessesService, PlatformAdminGuard],
})
export class AdminModule {}
