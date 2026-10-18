import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import type { Redis } from 'ioredis'
import { AppException } from '../../common/errors/app.exception.js'
import type { AuthUser, HttpRequest } from '../../common/http/request.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { adminUserRoles, roles } from '../../database/schema/index.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import {
  coversPermissions,
  defineAbilityFor,
  type AppAbility,
} from './ability.js'
import { SYSTEM_ROLES } from './permissions.js'

export interface AdminAccess {
  roles: string[]
  permissions: string[]
}

const VERSION_KEY = 'rbac:version'
const CACHE_TTL_SECONDS = 10 * 60

/** Roles and permissions of admin console accounts (client users have none). */
@Injectable()
export class RbacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacService.name)

  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Creates missing system roles and re-applies `super_admin`'s permissions. */
  async onApplicationBootstrap(): Promise<void> {
    for (const role of Object.values(SYSTEM_ROLES)) {
      await this.db
        .insert(roles)
        .values({ ...role, permissions: [...role.permissions], isSystem: true })
        .onConflictDoNothing({ target: roles.code })
    }
    await this.db
      .update(roles)
      .set({
        permissions: [...SYSTEM_ROLES.superAdmin.permissions],
        isSystem: true,
      })
      .where(eq(roles.code, SYSTEM_ROLES.superAdmin.code))
    await this.invalidateAll()
    this.logger.log('System roles are in place')
  }

  /** Role codes and the union of their permissions, cached in Redis. */
  async getAdminAccess(adminUserId: string): Promise<AdminAccess> {
    const key = await this.cacheKey(adminUserId)
    const cached = await this.redis.get(key)
    if (cached) {
      return JSON.parse(cached) as AdminAccess
    }
    const rows = await this.db
      .select({ code: roles.code, permissions: roles.permissions })
      .from(adminUserRoles)
      .innerJoin(roles, eq(adminUserRoles.roleId, roles.id))
      .where(eq(adminUserRoles.adminUserId, adminUserId))
    const access: AdminAccess = {
      roles: rows.map((row) => row.code).sort(),
      permissions: [...new Set(rows.flatMap((row) => row.permissions))].sort(),
    }
    await this.redis.set(key, JSON.stringify(access), 'EX', CACHE_TTL_SECONDS)
    return access
  }

  async abilityFor(adminUserId: string): Promise<AppAbility> {
    const { permissions } = await this.getAdminAccess(adminUserId)
    return defineAbilityFor({ id: adminUserId, permissions })
  }

  /** Request-scoped memoized ability of the signed-in admin. */
  async abilityForRequest(
    request: HttpRequest & { user: AuthUser },
  ): Promise<AppAbility> {
    request.ability ??= await this.abilityFor(request.user.id)
    return request.ability
  }

  /**
   * 403 `PERMISSIONS_EXCEED_OWN` unless `ability` covers every permission of the admin account, so only
   * super admins can change super admins and nobody can lock out an admin with more access.
   */
  async assertCanManageAdmin(
    ability: AppAbility,
    adminUserId: string,
  ): Promise<void> {
    const { permissions } = await this.getAdminAccess(adminUserId)
    if (!coversPermissions(ability, permissions)) {
      throw new AppException('PERMISSIONS_EXCEED_OWN')
    }
  }

  /** Union of the permissions of the roles; 400 `ROLES_UNKNOWN` when one of them does not exist. */
  async permissionsOfRoles(roleIds: readonly string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return []
    }
    const found = await this.db
      .select({ permissions: roles.permissions })
      .from(roles)
      .where(inArray(roles.id, [...roleIds]))
    if (found.length !== new Set(roleIds).size) {
      throw new AppException('ROLES_UNKNOWN')
    }
    return [...new Set(found.flatMap((role) => role.permissions))]
  }

  /** Call after changing an admin's roles. */
  async invalidateAdmin(adminUserId: string): Promise<void> {
    await this.redis.del(await this.cacheKey(adminUserId))
  }

  /** Call after changing a role's permissions or deleting a role. */
  async invalidateAll(): Promise<void> {
    await this.redis.incr(VERSION_KEY)
  }

  async assignRoles(
    adminUserId: string,
    roleIds: string[],
    executor: Pick<Database, 'insert' | 'delete'> = this.db,
  ) {
    await executor
      .delete(adminUserRoles)
      .where(eq(adminUserRoles.adminUserId, adminUserId))
    if (roleIds.length > 0) {
      await executor
        .insert(adminUserRoles)
        .values(roleIds.map((roleId) => ({ adminUserId, roleId })))
        .onConflictDoNothing()
    }
  }

  async findRoleIdByCode(code: string): Promise<string | undefined> {
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1)
    return role?.id
  }

  private async cacheKey(adminUserId: string): Promise<string> {
    const version = (await this.redis.get(VERSION_KEY)) ?? '0'
    return `rbac:v${version}:admin:${adminUserId}`
  }
}
