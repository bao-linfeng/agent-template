import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module.js';
import { AdminMeController, AdminsController } from './admins.controller.js';
import { AdminsService } from './admins.service.js';

/** Admin console accounts: `/admin/me` for the signed-in admin, `/admin/admins` for administration. */
@Module({
  imports: [AccountsModule],
  controllers: [AdminMeController, AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
