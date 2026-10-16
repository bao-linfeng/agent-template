import { Body, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  requestMeta,
  type HttpReply,
  type HttpRequest,
} from '../../../common/http/request.js'
import type { AccountRow } from '../../accounts/accounts.service.js'
import {
  AdminsService,
  type AdminProfile,
} from '../../admins/admins.service.js'
import { Audit, setAuditActor } from '../../audit/audit-context.js'
import { MfaLoginDto } from '../../mfa/dto/mfa.dto.js'
import { MfaService, type MfaChallenge } from '../../mfa/mfa.service.js'
import { AuthCookies } from '../auth-cookies.service.js'
import { AuthService } from '../auth.service.js'
import { CredentialsController } from '../credentials.controller.js'
import { AdminController, AuthThrottle, Public } from '../decorators.js'
import { SessionsService } from '../sessions.service.js'

/**
 * Admin console accounts (no registration, cookies only). Cookies: `admin_access_token`
 * (path `/<prefix>/v1/admin`), `admin_refresh_token` (path `/<prefix>/v1/admin/auth`).
 * Admins with two-factor authentication sign in with `login` (password → challenge) and then
 * `login/mfa` (code → cookies).
 */
@ApiTags('admin / auth')
@Public()
@AdminController('auth')
export class AdminAuthController extends CredentialsController<AdminProfile> {
  protected readonly realm = 'admin'

  constructor(
    auth: AuthService,
    cookies: AuthCookies,
    sessions: SessionsService,
    private readonly admins: AdminsService,
    private readonly mfa: MfaService,
  ) {
    super(auth, cookies, sessions)
  }

  protected profile(account: AccountRow): Promise<AdminProfile> {
    return this.admins.getProfile(account.id)
  }

  protected override secondFactor(
    account: AccountRow,
  ): Promise<MfaChallenge | null> {
    return this.mfa.createChallenge(account)
  }

  /**
   * Completes a sign-in that answered `mfaRequired` with an authenticator code or a recovery code:
   * sets the session cookies and returns the profile. 400 `AUTH_MFA_CODE_INVALID` for a wrong code
   * (5 tries per challenge), 400 `AUTH_MFA_CHALLENGE_INVALID` when the challenge expired or ran out.
   */
  @Post('login/mfa')
  @HttpCode(200)
  @AuthThrottle()
  @Audit({ redact: ['code'] })
  async loginMfa(
    @Body() dto: MfaLoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<AdminProfile> {
    const account = await this.mfa.completeChallenge(
      dto.challengeToken,
      dto.code,
    )
    setAuditActor(request, account)
    const { tokens } = await this.auth.startSession(
      this.realm,
      account,
      requestMeta(request),
    )
    this.cookies.set(reply, this.realm, tokens)
    return this.profile(account)
  }
}
