import { Body, Get, HttpCode, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import { Audit } from '../../audit/audit-context.js'
import {
  AdminController,
  AuthThrottle,
  CurrentUser,
} from '../../auth/decorators.js'
import {
  ConfirmMfaDto,
  EnableTotpDto,
  StartTotpSetupDto,
} from '../dto/mfa.dto.js'
import {
  MfaService,
  type MfaStatus,
  type RecoveryCodes,
  type TotpSetup,
} from '../mfa.service.js'

/**
 * Two-factor authentication of the signed-in admin: an authenticator app (TOTP) plus one-time
 * recovery codes. Enabling takes two calls (`totp/setup`, then `totp/enable` with the first code).
 */
@ApiTags('admin / me')
@AdminController('me/mfa')
@Audit({ redact: ['code'] })
export class AdminMfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get()
  status(@CurrentUser() user: AuthUser): Promise<MfaStatus> {
    return this.mfa.status(user.id)
  }

  /**
   * Creates a pending secret (valid 10 minutes) and returns it with an `otpauth://` URI for the QR
   * code. 409 `MFA_ALREADY_ENABLED` when TOTP is on.
   */
  @Post('totp/setup')
  @HttpCode(200)
  @AuthThrottle()
  startSetup(
    @CurrentUser() user: AuthUser,
    @Body() dto: StartTotpSetupDto,
  ): Promise<TotpSetup> {
    return this.mfa.startTotpSetup(user.id, dto.password)
  }

  /**
   * Confirms the pending secret with a code from the app. Returns 10 recovery codes (shown only
   * now) and signs out every other session.
   */
  @Post('totp/enable')
  @HttpCode(200)
  @AuthThrottle()
  enable(
    @CurrentUser() user: AuthUser,
    @Body() dto: EnableTotpDto,
  ): Promise<RecoveryCodes> {
    return this.mfa.enableTotp(user.id, user.sessionId, dto.code)
  }

  /** Turns two-factor authentication off (password + authenticator or recovery code). */
  @Post('totp/disable')
  @HttpCode(204)
  @AuthThrottle()
  disable(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmMfaDto,
  ): Promise<void> {
    return this.mfa.disableTotp(user.id, dto.password, dto.code)
  }

  /** Replaces all recovery codes (password + authenticator or recovery code); the old ones stop working. */
  @Post('recovery-codes')
  @HttpCode(200)
  @AuthThrottle()
  regenerateRecoveryCodes(
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmMfaDto,
  ): Promise<RecoveryCodes> {
    return this.mfa.regenerateRecoveryCodes(user.id, dto.password, dto.code)
  }
}
