import { Body, Post, Req, Res } from '@nestjs/common'
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
import { AuthCookies } from '../auth-cookies.service.js'
import { AuthService } from '../auth.service.js'
import { usesBearerTransport } from '../bearer.js'
import {
  authTransportHeader,
  CredentialsController,
  type BearerSignIn,
} from '../credentials.controller.js'
import { AuthThrottle, ClientController, Public } from '../decorators.js'
import { RegisterDto } from '../dto/auth.dto.js'
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
   * Registers a client account and signs in; returns the profile (or `{ account, tokens }` for bearer clients).
   * Upload an avatar afterwards via `PUT /v1/client/users/me/avatar`.
   */
  @Post('register')
  @AuthThrottle()
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
    return this.signIn(bearer, reply, tokens, this.accounts.toPublic(account))
  }
}
