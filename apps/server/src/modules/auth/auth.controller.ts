import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  requestMeta,
  type HttpReply,
  type HttpRequest,
} from '../../common/http/request.js';
import {
  AccountsService,
  type AccountRow,
  type PublicAccount,
} from '../accounts/accounts.service.js';
import { AdminsService, type AdminProfile } from '../admins/admins.service.js';
import { AuthCookies } from './auth-cookies.service.js';
import { AuthService } from './auth.service.js';
import { AdminController, AuthThrottle, Public } from './decorators.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';
import type { Realm } from './realms.js';

/**
 * Cookie-based credential flows shared by both realms. Successful login/refresh set the realm's
 * HttpOnly access and refresh cookies (see `REALM_COOKIES`); clients call `POST <auth>/refresh` when
 * an API call returns 401.
 */
abstract class CredentialsController<Profile> {
  protected abstract readonly realm: Realm;

  constructor(
    protected readonly auth: AuthService,
    protected readonly cookies: AuthCookies,
  ) {}

  protected abstract profile(account: AccountRow): Promise<Profile>;

  @Post('login')
  @HttpCode(200)
  @AuthThrottle()
  async login(
    @Body() dto: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<Profile> {
    const { tokens, account } = await this.auth.login(
      this.realm,
      dto,
      requestMeta(request),
    );
    this.cookies.set(reply, this.realm, tokens);
    return this.profile(account);
  }

  @Post('refresh')
  @HttpCode(204)
  async refresh(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<void> {
    try {
      const tokens = await this.auth.refresh(
        this.realm,
        this.cookies.read(request, this.realm).refreshToken,
        requestMeta(request),
      );
      this.cookies.set(reply, this.realm, tokens);
    } catch (error) {
      this.cookies.clear(reply, this.realm);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<void> {
    const { accessToken, refreshToken } = this.cookies.read(
      request,
      this.realm,
    );
    await this.auth.logout(this.realm, accessToken, refreshToken);
    this.cookies.clear(reply, this.realm);
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
    await this.auth.forgotPassword(this.realm, dto, requestMeta(request));
    return {
      message: 'If the email is registered, a reset link has been sent',
    };
  }

  /** Sets a new password from a reset token and signs out every session. */
  @Post('reset-password')
  @HttpCode(204)
  @AuthThrottle()
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(this.realm, dto);
  }
}

/** Client app accounts. Cookies: `access_token` (path `/`), `refresh_token` (path `/<prefix>/auth`). */
@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController extends CredentialsController<PublicAccount> {
  protected readonly realm = 'user';

  constructor(
    auth: AuthService,
    cookies: AuthCookies,
    private readonly accounts: AccountsService,
  ) {
    super(auth, cookies);
  }

  protected profile(account: AccountRow): Promise<PublicAccount> {
    return Promise.resolve(this.accounts.toPublic(account));
  }

  /** Registers a client account and signs in; returns the profile. Upload an avatar afterwards via `PUT /users/me/avatar`. */
  @Post('register')
  @AuthThrottle()
  async register(
    @Body() dto: RegisterDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<PublicAccount> {
    const { tokens, account } = await this.auth.register(
      dto,
      requestMeta(request),
    );
    this.cookies.set(reply, this.realm, tokens);
    return this.accounts.toPublic(account);
  }
}

/**
 * Admin console accounts (no registration). Cookies: `admin_access_token` (path `/<prefix>/admin`),
 * `admin_refresh_token` (path `/<prefix>/admin/auth`).
 */
@ApiTags('admin / auth')
@Public()
@AdminController('auth')
export class AdminAuthController extends CredentialsController<AdminProfile> {
  protected readonly realm = 'admin';

  constructor(
    auth: AuthService,
    cookies: AuthCookies,
    private readonly admins: AdminsService,
  ) {
    super(auth, cookies);
  }

  protected profile(account: AccountRow): Promise<AdminProfile> {
    return this.admins.getProfile(account.id);
  }
}
