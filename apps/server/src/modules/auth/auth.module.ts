import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminsModule } from '../admins/admins.module.js'
import { AdminAuthController, AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'

@Module({
  imports: [AccountsModule, AdminsModule],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService],
})
export class AuthModule {}
