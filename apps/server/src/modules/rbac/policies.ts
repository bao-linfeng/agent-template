import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AppException } from '../../common/errors/app.exception.js'
import type { AuthUser, HttpRequest } from '../../common/http/request.js'
import { canAny, coversPermissions, type AppAbility } from './ability.js'
import { parsePermission, type Permission } from './permissions.js'
import { RbacService } from './rbac.service.js'

export type PolicyHandler = (ability: AppAbility) => boolean

const POLICIES_KEY = 'rbac:policies'

/** Route-level checks on `@AdminController` routes, e.g. `@CheckPolicies((ability) => ability.can('read', 'User'))`. */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(POLICIES_KEY, handlers)

/**
 * Requires unconditional permissions (all records) on an `@AdminController` route, e.g.
 * `@RequirePermissions('user:read')`. Record-level checks use `assertCan(ability, action, asSubject(...))`.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  CheckPolicies(
    ...permissions.map((permission) => {
      const { action, subject } = parsePermission(permission)
      return (ability: AppAbility) => canAny(ability, action, subject)
    }),
  )

/** Injects the signed-in admin's CASL ability (admin routes only; client users have no ability). */
export const CurrentAbility = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppAbility => {
    const ability = context.switchToHttp().getRequest<HttpRequest>().ability
    if (!ability) {
      throw new Error(
        'Ability not resolved; is this an @AdminController route and PoliciesGuard registered globally?',
      )
    }
    return ability
  },
)

export function assertCan(
  ability: AppAbility,
  ...args: Parameters<AppAbility['can']>
): void {
  if (!ability.can(...args)) {
    throw new AppException('PERMISSION_DENIED')
  }
}

/**
 * 403 `PERMISSIONS_EXCEED_OWN` unless the admin holds every permission in `permissions`: nobody may hand
 * out more than they have, or change roles and accounts that have more.
 */
export function assertCovers(
  ability: AppAbility,
  permissions: readonly string[],
): void {
  if (!coversPermissions(ability, permissions)) {
    throw new AppException('PERMISSIONS_EXCEED_OWN')
  }
}

/**
 * Global guard (after JwtAuthGuard): resolves the ability of signed-in admins and runs policies.
 * Client sessions never get an ability, so policies on a client route always deny.
 */
@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbac: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handlers =
      this.reflector.getAllAndOverride<PolicyHandler[] | undefined>(
        POLICIES_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? []
    const request = context.switchToHttp().getRequest<HttpRequest>()
    if (!request.user) {
      if (handlers.length > 0) {
        throw new AppException('AUTH_REQUIRED')
      }
      return true
    }
    if (request.user.realm !== 'admin') {
      if (handlers.length > 0) {
        throw new AppException('PERMISSION_DENIED')
      }
      return true
    }
    const ability = await this.rbac.abilityForRequest(
      request as HttpRequest & { user: AuthUser },
    )
    if (!handlers.every((handler) => handler(ability))) {
      throw new AppException('PERMISSION_DENIED')
    }
    return true
  }
}
