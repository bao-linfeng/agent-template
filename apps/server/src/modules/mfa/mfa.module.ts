import { Module } from '@nestjs/common'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AdminMfaController } from './admin/mfa.controller.js'
import { MfaService } from './mfa.service.js'

/**
 * Two-factor authentication of admin console accounts: `/v1/admin/me/mfa` for the signed-in admin;
 * the sign-in step lives in the admin auth controller, the reset for others under `/v1/admin/admins`.
 */
@Module({
  imports: [AccountsModule],
  controllers: [AdminMfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
