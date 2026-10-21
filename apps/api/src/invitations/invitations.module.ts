import { Module } from '@nestjs/common';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { MailModule } from '../mail/mail.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { BusinessInvitationsController } from './business-invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { MembersController } from './members.controller.js';
import { PublicInvitationsController } from './public-invitations.controller.js';

@Module({
  imports: [BusinessesModule, MailModule, StorageModule],
  controllers: [BusinessInvitationsController, PublicInvitationsController, MembersController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
