import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock.js';
import { StorageModule } from '../storage/storage.module.js';
import { BusinessAccessGuard } from './business-access.guard.js';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { MeBusinessesController } from './me-businesses.controller.js';

@Module({
  imports: [StorageModule],
  controllers: [BusinessesController, MeBusinessesController],
  providers: [BusinessesService, BusinessAccessGuard, { provide: Clock, useClass: SystemClock }],
  exports: [BusinessesService, BusinessAccessGuard, Clock],
})
export class BusinessesModule {}
