import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Redis } from 'ioredis'
import type { HttpRequest } from '../../common/http/request.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { revokedSessionKey, type AccessTokenPayload } from './auth.constants.js'
import { IS_PUBLIC_KEY, REALM_KEY } from './decorators.js'
import { REALM_COOKIES, type Realm } from './realms.js'

/**
 * Global guard: every route requires a valid access token of its realm unless marked `@Public()`.
 * Admin routes (`@AdminController`) read `admin_access_token`, every other route `access_token`; a
 * token issued for the other realm is rejected. Revoked sessions are rejected via Redis.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()]
    if (
      this.reflector.getAllAndOverride<boolean | undefined>(
        IS_PUBLIC_KEY,
        targets,
      )
    ) {
      return true
    }
    const realm =
      this.reflector.getAllAndOverride<Realm | undefined>(REALM_KEY, targets) ??
      'user'

    const request = context.switchToHttp().getRequest<HttpRequest>()
    const token = request.cookies?.[REALM_COOKIES[realm].access]
    if (!token) {
      throw new UnauthorizedException('Authentication required')
    }

    let payload: AccessTokenPayload
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token)
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token')
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.email !== 'string' ||
      payload.realm !== realm
    ) {
      throw new UnauthorizedException('Invalid authentication token')
    }
    if (await this.redis.exists(revokedSessionKey(realm, payload.sid))) {
      throw new UnauthorizedException('Session has been revoked')
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
      realm,
    }
    return true
  }
}
