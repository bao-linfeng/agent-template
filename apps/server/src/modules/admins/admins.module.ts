import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminsController } from './admin/admins.controller.js'
import { AdminMeController } from './admin/me.controller.js'
import { AdminsService } from './admins.service.js'

/** Admin console accounts: `/v1/admin/me` for the signed-in admin, `/v1/admin/admins` for administration. */
@Module({
  imports: [AccountsModule],
  controllers: [AdminMeController, AdminsController],
  providers: [AdminsService],
  exports: [AdminsService],
})
export class AdminsModule {}
