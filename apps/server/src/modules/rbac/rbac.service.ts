import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import type { AuthUser, HttpRequest } from '../../common/http/request.js';
import type { Database } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import { roles, userRoles } from '../../database/schema/index.js';
import { InjectRedis } from '../../infra/redis/redis.module.js';
import { defineAbilityFor, type AppAbility } from './ability.js';
import { SYSTEM_ROLES } from './permissions.js';

export interface UserAccess {
  roles: string[];
  permissions: string[];
}

const VERSION_KEY = 'rbac:version';
const CACHE_TTL_SECONDS = 10 * 60;

@Injectable()
export class RbacService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RbacService.name);

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
        .onConflictDoNothing({ target: roles.code });
    }
    await this.db
      .update(roles)
      .set({
        permissions: [...SYSTEM_ROLES.superAdmin.permissions],
        isSystem: true,
      })
      .where(eq(roles.code, SYSTEM_ROLES.superAdmin.code));
    await this.invalidateAll();
    this.logger.log('System roles are in place');
  }

  /** Role codes and the union of their permissions, cached in Redis. */
  async getUserAccess(userId: string): Promise<UserAccess> {
    const key = await this.cacheKey(userId);
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached) as UserAccess;
    }
    const rows = await this.db
      .select({ code: roles.code, permissions: roles.permissions })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, userId));
    const access: UserAccess = {
      roles: rows.map((row) => row.code).sort(),
      permissions: [...new Set(rows.flatMap((row) => row.permissions))].sort(),
    };
    await this.redis.set(key, JSON.stringify(access), 'EX', CACHE_TTL_SECONDS);
    return access;
  }

  async abilityFor(user: AuthUser): Promise<AppAbility> {
    const { permissions } = await this.getUserAccess(user.id);
    return defineAbilityFor({ id: user.id, permissions });
  }

  /** Request-scoped memoized ability. */
  async abilityForRequest(
    request: HttpRequest & { user: AuthUser },
  ): Promise<AppAbility> {
    request.ability ??= await this.abilityFor(request.user);
    return request.ability;
  }

  /** Call after changing a user's roles. */
  async invalidateUser(userId: string): Promise<void> {
    await this.redis.del(await this.cacheKey(userId));
  }

  /** Call after changing a role's permissions or deleting a role. */
  async invalidateAll(): Promise<void> {
    await this.redis.incr(VERSION_KEY);
  }

  async assignRoles(
    userId: string,
    roleIds: string[],
    executor: Pick<Database, 'insert' | 'delete'> = this.db,
  ) {
    await executor.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length > 0) {
      await executor
        .insert(userRoles)
        .values(roleIds.map((roleId) => ({ userId, roleId })))
        .onConflictDoNothing();
    }
  }

  async findRoleIdByCode(code: string): Promise<string | undefined> {
    const [role] = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(eq(roles.code, code))
      .limit(1);
    return role?.id;
  }

  private async cacheKey(userId: string): Promise<string> {
    const version = (await this.redis.get(VERSION_KEY)) ?? '0';
    return `rbac:v${version}:user:${userId}`;
  }
}
