import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminUsersController } from './admin/users.controller.js'
import { MeController } from './client/me.controller.js'

/** Client app accounts: `/v1/client/users/me` for the user, `/v1/admin/users` for administrators. */
@Module({
  imports: [AccountsModule],
  controllers: [MeController, AdminUsersController],
})
export class UsersModule {}
