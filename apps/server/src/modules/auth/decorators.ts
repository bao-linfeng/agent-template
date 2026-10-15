import {
  applyDecorators,
  Controller,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common'
import type { AuthUser, HttpRequest } from '../../common/http/request.js'
import type { Realm } from './realms.js'

export const IS_PUBLIC_KEY = 'auth:public'
export const AUTH_THROTTLE_KEY = 'auth:throttle'
export const REALM_KEY = 'auth:realm'

/** Skips authentication for a route or controller (all routes require auth by default). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/** Applies the stricter `auth` rate limit (AUTH_THROTTLE_*) to credential endpoints. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true)

/**
 * Admin console controller: routes live under `/admin/<path>` and only accept admin sessions
 * (`admin_access_token`), so `@RequirePermissions` and friends can be used. Controllers declared with
 * plain `@Controller` belong to the client realm and only accept client sessions.
 */
export function AdminController(path = ''): ClassDecorator {
  return applyDecorators(
    Controller(path ? `admin/${path}` : 'admin'),
    SetMetadata(REALM_KEY, 'admin' satisfies Realm),
  )
}

/** Injects the authenticated account (`{ id, email, sessionId, realm }`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const user = context.switchToHttp().getRequest<HttpRequest>().user
    if (!user) {
      throw new Error('CurrentUser used on a public route')
    }
    return user
  },
)
