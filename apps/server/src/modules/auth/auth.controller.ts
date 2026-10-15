import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  requestMeta,
  type HttpReply,
  type HttpRequest,
} from '../../common/http/request.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import { AuthCookies } from './auth-cookies.service.js';
import { AuthService } from './auth.service.js';
import { AuthThrottle, Public } from './decorators.js';
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto.js';

/**
 * Cookie-based auth: successful register/login/refresh set HttpOnly `access_token` (path `/`) and
 * `refresh_token` (path `/<prefix>/auth`). Clients call `POST /auth/refresh` when an API call returns 401.
 */
@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  /** Registers and signs in; returns the profile. Upload an avatar afterwards via `PUT /users/me/avatar`. */
  @Post('register')
  @AuthThrottle()
  async register(
    @Body() dto: RegisterDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    const { tokens, user } = await this.auth.register(
      dto,
      requestMeta(request),
    );
    this.cookies.set(reply, tokens);
    return user;
  }

  @Post('login')
  @HttpCode(200)
  @AuthThrottle()
  async login(
    @Body() dto: LoginDto,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    const { tokens, user } = await this.auth.login(dto, requestMeta(request));
    this.cookies.set(reply, tokens);
    return user;
  }

  @Post('refresh')
  @HttpCode(204)
  async refresh(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    try {
      const tokens = await this.auth.refresh(
        request.cookies[REFRESH_TOKEN_COOKIE],
        requestMeta(request),
      );
      this.cookies.set(reply, tokens);
    } catch (error) {
      this.cookies.clear(reply);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    await this.auth.logout(
      request.cookies[ACCESS_TOKEN_COOKIE],
      request.cookies[REFRESH_TOKEN_COOKIE],
    );
    this.cookies.clear(reply);
  }

  /**
   * Always 202 whether or not the email exists. Emails `<resetUrl>?token=...` (default `APP_WEB_URL/reset-password`);
   * `resetUrl` must be on `APP_WEB_URL` or a `CORS_ORIGINS` origin, so the admin console and the client can each use their own page.
   */
  @Post('forgot-password')
  @HttpCode(202)
  @AuthThrottle()
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: HttpRequest,
  ) {
    await this.auth.forgotPassword(dto, requestMeta(request));
    return {
      message: 'If the email is registered, a reset link has been sent',
    };
  }

  /** Sets a new password from a reset token and signs out every session. */
  @Post('reset-password')
  @HttpCode(204)
  @AuthThrottle()
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
  }
}
