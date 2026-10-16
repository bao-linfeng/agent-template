import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminsModule } from '../admins/admins.module.js'
import { MfaModule } from '../mfa/mfa.module.js'
import { AdminAuthController } from './admin/auth.controller.js'
import { AuthController } from './client/auth.controller.js'
import { AuthService } from './auth.service.js'
import { VerificationCodesService } from './verification-codes.service.js'

@Module({
  imports: [AccountsModule, AdminsModule, MfaModule],
  controllers: [AuthController, AdminAuthController],
  providers: [AuthService, VerificationCodesService],
})
export class AuthModule {}
