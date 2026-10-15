import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieSerializeOptions } from '@fastify/cookie';
import type { HttpReply } from '../../common/http/request.js';
import type { Env } from '../../config/env.js';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants.js';
import type { IssuedTokens } from './sessions.service.js';
import { SessionsService } from './sessions.service.js';

/**
 * Auth cookies are HttpOnly + SameSite=Lax. The refresh token is scoped to the auth routes so it is
 * not sent with ordinary API calls.
 */
@Injectable()
export class AuthCookies {
  private readonly base: CookieSerializeOptions;
  readonly refreshPath: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly sessions: SessionsService,
  ) {
    this.base = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      domain: config.get('COOKIE_DOMAIN', { infer: true }),
    };
    this.refreshPath = `/${config.get('API_PREFIX', { infer: true })}/auth`;
  }

  set(reply: HttpReply, tokens: IssuedTokens): void {
    reply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...this.base,
      path: '/',
      maxAge: this.sessions.accessTtlSeconds,
    });
    reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...this.base,
      path: this.refreshPath,
      maxAge: this.sessions.refreshTtlSeconds,
    });
  }

  clear(reply: HttpReply): void {
    reply.clearCookie(ACCESS_TOKEN_COOKIE, { ...this.base, path: '/' });
    reply.clearCookie(REFRESH_TOKEN_COOKIE, {
      ...this.base,
      path: this.refreshPath,
    });
  }
}
