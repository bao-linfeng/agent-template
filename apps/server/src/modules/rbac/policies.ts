import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser, HttpRequest } from '../../common/http/request.js';
import { canAny, type AppAbility } from './ability.js';
import { parsePermission, type Permission } from './permissions.js';
import { RbacService } from './rbac.service.js';

export type PolicyHandler = (ability: AppAbility) => boolean;

const POLICIES_KEY = 'rbac:policies';

/** Route-level checks, e.g. `@CheckPolicies((ability) => ability.can('read', 'User'))`. */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(POLICIES_KEY, handlers);

/**
 * Requires unconditional permissions (all records), e.g. `@RequirePermissions('user:read')`.
 * Ownership-scoped access is checked in services with `assertCan(ability, action, asSubject(...))`.
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  CheckPolicies(
    ...permissions.map((permission) => {
      const { action, subject } = parsePermission(permission);
      return (ability: AppAbility) => canAny(ability, action, subject);
    }),
  );

/** Injects the current user's CASL ability (requires an authenticated route). */
export const CurrentAbility = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AppAbility => {
    const ability = context.switchToHttp().getRequest<HttpRequest>().ability;
    if (!ability) {
      throw new Error(
        'Ability not resolved; is PoliciesGuard registered globally?',
      );
    }
    return ability;
  },
);

export function assertCan(
  ability: AppAbility,
  ...args: Parameters<AppAbility['can']>
): void {
  if (!ability.can(...args)) {
    throw new ForbiddenException(
      'You do not have permission to perform this action',
    );
  }
}

/** Global guard (after JwtAuthGuard): resolves the ability for authenticated requests and runs policies. */
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
      ) ?? [];
    const request = context.switchToHttp().getRequest<HttpRequest>();
    if (!request.user) {
      if (handlers.length > 0) {
        throw new UnauthorizedException('Authentication required');
      }
      return true;
    }
    const ability = await this.rbac.abilityForRequest(
      request as HttpRequest & { user: AuthUser },
    );
    if (!handlers.every((handler) => handler(ability))) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return true;
  }
}
