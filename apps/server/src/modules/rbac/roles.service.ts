import { Injectable } from '@nestjs/common'
import { asc, count, eq } from 'drizzle-orm'
import { AppException } from '../../common/errors/app.exception.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { hasValues } from '../../database/update-values.js'
import {
  adminUserRoles,
  roles,
  type RoleRow,
} from '../../database/schema/index.js'
import type { AppAbility } from './ability.js'
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js'
import { SYSTEM_ROLES } from './permissions.js'
import { assertCovers } from './policies.js'
import { RbacService } from './rbac.service.js'

export type RoleView = Omit<RoleRow, 'createdAt' | 'updatedAt'> & {
  /** Number of admin accounts holding the role. */
  userCount: number
  createdAt: Date
}

@Injectable()
export class RolesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly rbac: RbacService,
  ) {}

  async list(): Promise<RoleView[]> {
    const rows = await this.db
      .select({
        id: roles.id,
        code: roles.code,
        name: roles.name,
        description: roles.description,
        isSystem: roles.isSystem,
        permissions: roles.permissions,
        createdAt: roles.createdAt,
        userCount: count(adminUserRoles.adminUserId),
      })
      .from(roles)
      .leftJoin(adminUserRoles, eq(adminUserRoles.roleId, roles.id))
      .groupBy(roles.id)
      .orderBy(asc(roles.createdAt))
    return rows
  }

  async get(id: string): Promise<RoleRow> {
    const role = await this.db.query.roles.findFirst({
      where: eq(roles.id, id),
    })
    if (!role) {
      throw new AppException('ROLE_NOT_FOUND')
    }
    return role
  }

  /** `ability` must hold every permission of the role (403 `PERMISSIONS_EXCEED_OWN`). */
  async create(dto: CreateRoleDto, ability: AppAbility): Promise<RoleRow> {
    assertCovers(ability, dto.permissions)
    const [role] = await this.db
      .insert(roles)
      .values({
        code: dto.code,
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
        isSystem: false,
      })
      .onConflictDoNothing({ target: roles.code })
      .returning()
    if (!role) {
      throw new AppException('ROLE_CODE_TAKEN')
    }
    return role
  }

  /** `ability` must hold every permission the role has and gets (403 `PERMISSIONS_EXCEED_OWN`). */
  async update(
    id: string,
    dto: UpdateRoleDto,
    ability: AppAbility,
  ): Promise<RoleRow> {
    const role = await this.get(id)
    if (role.code === SYSTEM_ROLES.superAdmin.code && dto.permissions) {
      throw new AppException('ROLE_SUPER_ADMIN_IMMUTABLE')
    }
    assertCovers(ability, [...role.permissions, ...(dto.permissions ?? [])])
    const changes = {
      name: dto.name,
      description: dto.description,
      permissions: dto.permissions,
    }
    if (!hasValues(changes)) {
      return role
    }
    const [updated] = await this.db
      .update(roles)
      .set(changes)
      .where(eq(roles.id, id))
      .returning()
    await this.rbac.invalidateAll()
    return updated!
  }

  /** `ability` must hold every permission of the role (403 `PERMISSIONS_EXCEED_OWN`). */
  async remove(id: string, ability: AppAbility): Promise<void> {
    const role = await this.get(id)
    if (role.isSystem) {
      throw new AppException('ROLE_SYSTEM_UNDELETABLE')
    }
    assertCovers(ability, role.permissions)
    await this.db.delete(roles).where(eq(roles.id, id))
    await this.rbac.invalidateAll()
  }
}
