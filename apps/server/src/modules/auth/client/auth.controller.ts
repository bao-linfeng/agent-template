import { Body, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  requestMeta,
  type HttpReply,
  type HttpRequest,
} from '../../../common/http/request.js'
import {
  AccountsService,
  type AccountRow,
  type PublicAccount,
} from '../../accounts/accounts.service.js'
import { Audit, setAuditActor } from '../../audit/audit-context.js'
import { AuthCookies } from '../auth-cookies.service.js'
import { AuthService, type SentCode } from '../auth.service.js'
import { usesBearerTransport } from '../bearer.js'
import {
  authTransportHeader,
  CredentialsController,
  type BearerSignIn,
} from '../credentials.controller.js'
import { AuthThrottle, ClientController, Public } from '../decorators.js'
import { LoginDto, RegisterDto, SendRegisterCodeDto } from '../dto/auth.dto.js'
import { SessionsService } from '../sessions.service.js'

/**
 * Client app accounts. Browsers get `access_token` (path `/<prefix>/v1/client`) and `refresh_token`
 * (path `/<prefix>/v1/client/auth`) cookies; mini-programs and native apps send `X-Auth-Transport: bearer`.
 */
@ApiTags('client / auth')
@Public()
@ClientController('auth')
export class AuthController extends CredentialsController<PublicAccount> {
  protected readonly realm = 'user'

  constructor(
    auth: AuthService,
    cookies: AuthCookies,
    sessions: SessionsService,
    private readonly accounts: AccountsService,
  ) {
    super(auth, cookies, sessions)
  }

  protected profile(account: AccountRow): Promise<PublicAccount> {
    return Promise.resolve(this.accounts.toPublic(account))
  }

  /**
   * Emails a 6-digit registration code (valid `EMAIL_CODE_TTL_SECONDS`, one per email at a time).
   * 409 when the email is already registered, 429 within `EMAIL_CODE_RESEND_SECONDS` of the last code.
   */
  @Post('register/send-code')
  @HttpCode(202)
  @AuthThrottle()
  sendRegisterCode(@Body() dto: SendRegisterCodeDto): Promise<SentCode> {
    return this.auth.sendRegisterCode(dto)
  }

  /**
   * Registers a client account with the emailed `code` and signs in; a wrong code counts against the
   * code's attempt limit (400). Returns the profile (or `{ account, tokens }` for bearer clients).
   * Upload an avatar afterwards via `PUT /v1/client/users/me/avatar`.
   */
  @Post('register')
  @AuthThrottle()
  @Audit({ redact: ['code'] })
  @authTransportHeader
  async register(
    @Body() dto: RegisterDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<PublicAccount | BearerSignIn<PublicAccount>> {
    const bearer = usesBearerTransport(request, this.realm)
    const { tokens, account } = await this.auth.register(
      dto,
      requestMeta(request),
    )
    setAuditActor(request, account)
    return this.signIn(bearer, reply, tokens, this.accounts.toPublic(account))
  }

  /**
   * Cancels a pending account deletion and signs in, with the same body and response as `login`
   * (which answers 403 `AUTH_ACCOUNT_PENDING_DELETION` with `params.scheduledAt` for such accounts).
   * Signs in normally when no deletion is pending.
   */
  @Post('restore')
  @HttpCode(200)
  @AuthThrottle()
  @authTransportHeader
  async restore(
    @Body() dto: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<PublicAccount | BearerSignIn<PublicAccount>> {
    const bearer = usesBearerTransport(request, this.realm)
    const { tokens, account } = await this.auth.restore(
      this.realm,
      dto,
      requestMeta(request),
    )
    setAuditActor(request, account)
    return this.signIn(bearer, reply, tokens, this.accounts.toPublic(account))
  }
}
