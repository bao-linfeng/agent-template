import {
  applyDecorators,
  Controller,
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common'
import type { AuthUser, HttpRequest } from '../../common/http/request.js'
import { API_VERSION, REALM_ROUTES, type Realm } from './realms.js'

export const IS_PUBLIC_KEY = 'auth:public'
export const AUTH_THROTTLE_KEY = 'auth:throttle'
export const REALM_KEY = 'auth:realm'

/** Skips authentication for a route or controller (all routes require auth by default). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

/** Applies the stricter `auth` rate limit (AUTH_THROTTLE_*) to credential endpoints. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true)

function realmController(realm: Realm, path: string): ClassDecorator {
  const base = REALM_ROUTES[realm]
  return applyDecorators(
    Controller({
      path: path ? `${base}/${path}` : base,
      version: API_VERSION,
    }),
    SetMetadata(REALM_KEY, realm),
  )
}

/**
 * Client app controller: routes live under `/v1/client/<path>` and only accept client sessions
 * (`access_token`). Every client-facing route belongs here; plain `@Controller` is reserved for
 * unversioned, realm-less public routes such as `/health` and `/avatars`.
 */
export function ClientController(path = ''): ClassDecorator {
  return realmController('user', path)
}

/**
 * Admin console controller: routes live under `/v1/admin/<path>` and only accept admin sessions
 * (`admin_access_token`), so `@RequirePermissions` and friends can be used.
 */
export function AdminController(path = ''): ClassDecorator {
  return realmController('admin', path)
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
