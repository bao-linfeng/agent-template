import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { asc, count, eq } from 'drizzle-orm'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import {
  adminUserRoles,
  roles,
  type RoleRow,
} from '../../database/schema/index.js'
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js'
import { SYSTEM_ROLES } from './permissions.js'
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
      throw new NotFoundException('Role not found')
    }
    return role
  }

  async create(dto: CreateRoleDto): Promise<RoleRow> {
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
      throw new ConflictException('Role code already exists')
    }
    return role
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleRow> {
    const role = await this.get(id)
    if (role.code === SYSTEM_ROLES.superAdmin.code && dto.permissions) {
      throw new BadRequestException(
        'Permissions of super_admin cannot be changed',
      )
    }
    const [updated] = await this.db
      .update(roles)
      .set(dto)
      .where(eq(roles.id, id))
      .returning()
    await this.rbac.invalidateAll()
    return updated!
  }

  async remove(id: string): Promise<void> {
    const role = await this.get(id)
    if (role.isSystem) {
      throw new BadRequestException('System roles cannot be deleted')
    }
    await this.db.delete(roles).where(eq(roles.id, id))
    await this.rbac.invalidateAll()
  }
}
