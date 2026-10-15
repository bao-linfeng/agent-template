import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service.js';
import { AvatarsController } from './avatars.controller.js';

/** Realm-agnostic account primitives used by the client (`users`) and admin console (`admins`) modules. */
@Module({
  controllers: [AvatarsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
