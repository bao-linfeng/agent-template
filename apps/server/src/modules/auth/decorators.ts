import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { AuthUser, HttpRequest } from '../../common/http/request.js';

export const IS_PUBLIC_KEY = 'auth:public';
export const AUTH_THROTTLE_KEY = 'auth:throttle';

/** Skips authentication for a route or controller (all routes require auth by default). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Applies the stricter `auth` rate limit (AUTH_THROTTLE_*) to credential endpoints. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);

/** Injects the authenticated user (`{ id, email, sessionId }`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<HttpRequest>().user;
    if (!user) {
      throw new Error('CurrentUser used on a public route');
    }
    return user;
  },
);
