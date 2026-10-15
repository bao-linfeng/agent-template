import {
  BadRequestException,
  Body,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ApiHeader } from '@nestjs/swagger'
import {
  requestMeta,
  type HttpReply,
  type HttpRequest,
} from '../../common/http/request.js'
import type { AccountRow } from '../accounts/accounts.service.js'
import { AuthCookies } from './auth-cookies.service.js'
import { AuthService } from './auth.service.js'
import {
  AUTH_TRANSPORT_HEADER,
  readBearerToken,
  usesBearerTransport,
  type BearerTokens,
} from './bearer.js'
import { AuthThrottle } from './decorators.js'
import {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
} from './dto/auth.dto.js'
import type { Realm } from './realms.js'
import { SessionsService, type IssuedTokens } from './sessions.service.js'

/** Sign-in response of bearer clients; cookie clients get the bare profile. */
export interface BearerSignIn<Profile> {
  account: Profile
  tokens: BearerTokens
}

export const authTransportHeader = ApiHeader({
  name: AUTH_TRANSPORT_HEADER,
  required: false,
  enum: ['cookie', 'bearer'],
  description:
    '`bearer` (client realm only: mini-programs, native apps) returns the tokens in the body instead of setting cookies.',
})

/**
 * Credential flows shared by every realm; subclasses add the realm controller decorator. Browsers
 * get the realm's HttpOnly access and refresh cookies (see `REALM_COOKIES`) and call
 * `POST <auth>/refresh` when an API call returns 401. Clients of `BEARER_REALMS` that send
 * `X-Auth-Transport: bearer` get the tokens in the body instead and pass the refresh token back in it.
 */
export abstract class CredentialsController<Profile> {
  protected abstract readonly realm: Realm

  constructor(
    protected readonly auth: AuthService,
    protected readonly cookies: AuthCookies,
    protected readonly sessions: SessionsService,
  ) {}

  protected abstract profile(account: AccountRow): Promise<Profile>

  /** Returns the profile, or `{ account, tokens }` for bearer clients. */
  @Post('login')
  @HttpCode(200)
  @AuthThrottle()
  @authTransportHeader
  async login(
    @Body() dto: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<Profile | BearerSignIn<Profile>> {
    const bearer = usesBearerTransport(request, this.realm)
    const { tokens, account } = await this.auth.login(
      this.realm,
      dto,
      requestMeta(request),
    )
    return this.signIn(bearer, reply, tokens, await this.profile(account))
  }

  /** Rotates the session: 204 with new cookies, or 200 with new `BearerTokens` for bearer clients. */
  @Post('refresh')
  @HttpCode(204)
  @authTransportHeader
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<BearerTokens | void> {
    if (usesBearerTransport(request, this.realm)) {
      const tokens = await this.auth.refresh(
        this.realm,
        dto.refreshToken,
        requestMeta(request),
      )
      reply.status(200)
      return this.bearerTokens(tokens)
    }
    if (dto.refreshToken !== undefined) {
      throw new BadRequestException(
        'refreshToken in the body requires X-Auth-Transport: bearer',
      )
    }
    try {
      const tokens = await this.auth.refresh(
        this.realm,
        this.cookies.read(request, this.realm).refreshToken,
        requestMeta(request),
      )
      this.cookies.set(reply, this.realm, tokens)
    } catch (error) {
      this.cookies.clear(reply, this.realm)
      throw error
    }
  }

  /** Revokes the session of the access token (cookie or `Authorization` header) or of the refresh token. */
  @Post('logout')
  @HttpCode(204)
  @authTransportHeader
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<void> {
    if (usesBearerTransport(request, this.realm)) {
      await this.auth.logout(
        this.realm,
        readBearerToken(request),
        dto.refreshToken,
      )
      return
    }
    const { accessToken, refreshToken } = this.cookies.read(request, this.realm)
    await this.auth.logout(this.realm, accessToken, refreshToken)
    this.cookies.clear(reply, this.realm)
  }

  /**
   * Always 202 whether or not the email exists. Emails `<resetUrl>?token=...` (default `APP_WEB_URL/reset-password`);
   * `resetUrl` must be on `APP_WEB_URL` or a `CORS_ORIGINS` origin, so each web app can use its own page.
   */
  @Post('forgot-password')
  @HttpCode(202)
  @AuthThrottle()
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: HttpRequest,
  ) {
    await this.auth.forgotPassword(this.realm, dto, requestMeta(request))
    return {
      message: 'If the email is registered, a reset link has been sent',
    }
  }

  /** Sets a new password from a reset token and signs out every session. */
  @Post('reset-password')
  @HttpCode(204)
  @AuthThrottle()
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(this.realm, dto)
  }

  /** Completes a sign-in: cookies + profile, or `{ account, tokens }` for bearer clients. */
  protected signIn(
    bearer: boolean,
    reply: HttpReply,
    tokens: IssuedTokens,
    account: Profile,
  ): Profile | BearerSignIn<Profile> {
    if (bearer) {
      return { account, tokens: this.bearerTokens(tokens) }
    }
    this.cookies.set(reply, this.realm, tokens)
    return account
  }

  private bearerTokens(tokens: IssuedTokens): BearerTokens {
    return {
      tokenType: 'Bearer',
      accessToken: tokens.accessToken,
      expiresIn: this.sessions.accessTtlSeconds,
      refreshToken: tokens.refreshToken,
      refreshExpiresIn: this.sessions.refreshTtlSeconds,
    }
  }
}
