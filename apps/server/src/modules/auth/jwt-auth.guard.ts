import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import type { HttpRequest } from '../../common/http/request.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import {
  ACCESS_TOKEN_COOKIE,
  revokedSessionKey,
  type AccessTokenPayload,
} from './auth.constants.js';
import { IS_PUBLIC_KEY } from './decorators.js';

/**
 * Global guard: every route requires a valid `access_token` cookie unless marked `@Public()`.
 * Revoked sessions (logout, password change, disabled account) are rejected via Redis.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<HttpRequest>();
    const token = request.cookies?.[ACCESS_TOKEN_COOKIE];
    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string' ||
      typeof payload.email !== 'string'
    ) {
      throw new UnauthorizedException('Invalid authentication token');
    }
    if (await this.redis.exists(revokedSessionKey(payload.sid))) {
      throw new UnauthorizedException('Session has been revoked');
    }

    request.user = {
      id: payload.sub,
      email: payload.email,
      sessionId: payload.sid,
    };
    return true;
  }
}
