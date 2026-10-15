import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminUsersController } from './admin-users.controller.js'
import { MeController } from './users.controller.js'

/** Client app accounts: `/users/me` for the user, `/admin/users` for administrators. */
@Module({
  imports: [AccountsModule],
  controllers: [MeController, AdminUsersController],
})
export class UsersModule {}
