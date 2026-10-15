import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { CookieSerializeOptions } from '@fastify/cookie'
import type { HttpReply, HttpRequest } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import { REALM_COOKIES, type Realm } from './realms.js'
import type { IssuedTokens } from './sessions.service.js'
import { SessionsService } from './sessions.service.js'

/**
 * Auth cookies are HttpOnly + SameSite=Lax. Each realm has its own cookie names, so signing in to the
 * client app and the admin console in one browser never overwrites the other session. Cookies are
 * scoped to the realm's routes, and the refresh token to its auth routes so it is not sent with
 * ordinary API calls.
 */
@Injectable()
export class AuthCookies {
  private readonly base: CookieSerializeOptions
  private readonly prefix: string

  constructor(
    config: ConfigService<Env, true>,
    private readonly sessions: SessionsService,
  ) {
    this.base = {
      httpOnly: true,
      secure: config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'lax',
      domain: config.get('COOKIE_DOMAIN', { infer: true }),
    }
    this.prefix = `/${config.get('API_PREFIX', { infer: true })}`
  }

  /** Absolute cookie paths of a realm, e.g. `/api/v1/admin/auth`. */
  paths(realm: Realm): { access: string; refresh: string } {
    const { accessPath, refreshPath } = REALM_COOKIES[realm]
    return {
      access: `${this.prefix}${accessPath}`,
      refresh: `${this.prefix}${refreshPath}`,
    }
  }

  read(
    request: HttpRequest,
    realm: Realm,
  ): { accessToken?: string; refreshToken?: string } {
    const names = REALM_COOKIES[realm]
    return {
      accessToken: request.cookies?.[names.access],
      refreshToken: request.cookies?.[names.refresh],
    }
  }

  set(reply: HttpReply, realm: Realm, tokens: IssuedTokens): void {
    const names = REALM_COOKIES[realm]
    const paths = this.paths(realm)
    reply.setCookie(names.access, tokens.accessToken, {
      ...this.base,
      path: paths.access,
      maxAge: this.sessions.accessTtlSeconds,
    })
    reply.setCookie(names.refresh, tokens.refreshToken, {
      ...this.base,
      path: paths.refresh,
      maxAge: this.sessions.refreshTtlSeconds,
    })
  }

  clear(reply: HttpReply, realm: Realm): void {
    const names = REALM_COOKIES[realm]
    const paths = this.paths(realm)
    reply.clearCookie(names.access, { ...this.base, path: paths.access })
    reply.clearCookie(names.refresh, { ...this.base, path: paths.refresh })
  }
}
