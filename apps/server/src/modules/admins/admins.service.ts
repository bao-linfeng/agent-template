import { BadRequestException, Injectable } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import type { Paginated } from '../../common/dto/pagination.dto.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { adminUserRoles, roles } from '../../database/schema/index.js'
import {
  AccountsService,
  type PublicAccount,
} from '../accounts/accounts.service.js'
import type {
  AdminUpdateAccountDto,
  ListAccountsQueryDto,
} from '../accounts/dto/account.dto.js'
import { SYSTEM_ROLES } from '../rbac/permissions.js'
import { RbacService } from '../rbac/rbac.service.js'
import type { CreateAdminDto } from './dto/admin.dto.js'

/** `GET /v1/admin/me`: the signed-in admin with role and permission codes (build menus from them). */
export interface AdminProfile extends PublicAccount {
  roles: string[]
  permissions: string[]
}

/** Admin accounts as listed in `/v1/admin/admins`. */
export interface AdminView extends PublicAccount {
  roles: { id: string; code: string; name: string }[]
}

/** Admin console accounts: there is no self-registration, administrators create each other. */
@Injectable()
export class AdminsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly accounts: AccountsService,
    private readonly rbac: RbacService,
  ) {}

  async getProfile(id: string): Promise<AdminProfile> {
    const account = await this.accounts.getPublic('admin', id)
    return { ...account, ...(await this.rbac.getAdminAccess(id)) }
  }

  async list(query: ListAccountsQueryDto): Promise<Paginated<AdminView>> {
    const page = await this.accounts.list('admin', query)
    const rolesByAdmin = await this.rolesFor(page.items.map((row) => row.id))
    return {
      ...page,
      items: page.items.map((row) => ({
        ...this.accounts.toPublic(row),
        roles: rolesByAdmin.get(row.id) ?? [],
      })),
    }
  }

  async get(id: string): Promise<AdminView> {
    const account = await this.accounts.getPublic('admin', id)
    const rolesByAdmin = await this.rolesFor([id])
    return { ...account, roles: rolesByAdmin.get(id) ?? [] }
  }

  async create(dto: CreateAdminDto): Promise<AdminView> {
    const roleIds = dto.roleIds ?? []
    await this.assertRolesExist(roleIds)
    const admin = await this.db.transaction(async (tx) => {
      const created = await this.accounts.create('admin', dto, tx)
      await this.rbac.assignRoles(created.id, roleIds, tx)
      return created
    })
    return this.get(admin.id)
  }

  async update(
    actorId: string,
    id: string,
    dto: AdminUpdateAccountDto,
  ): Promise<AdminView> {
    if (dto.status === 'disabled' && actorId === id) {
      throw new BadRequestException('You cannot disable your own account')
    }
    await this.accounts.adminUpdate('admin', id, dto)
    return this.get(id)
  }

  /** Replaces the admin's roles. */
  async setRoles(
    actorId: string,
    id: string,
    roleIds: string[],
  ): Promise<AdminView> {
    await this.accounts.getOrThrow('admin', id)
    await this.assertRolesExist(roleIds)
    if (actorId === id) {
      // Prevent locking yourself out of the admin console by accident.
      const before = await this.rbac.getAdminAccess(id)
      const superAdminId = await this.rbac.findRoleIdByCode(
        SYSTEM_ROLES.superAdmin.code,
      )
      if (
        before.roles.includes(SYSTEM_ROLES.superAdmin.code) &&
        superAdminId &&
        !roleIds.includes(superAdminId)
      ) {
        throw new BadRequestException(
          'You cannot remove super_admin from yourself',
        )
      }
    }
    await this.db.transaction((tx) => this.rbac.assignRoles(id, roleIds, tx))
    await this.rbac.invalidateAdmin(id)
    return this.get(id)
  }

  private async assertRolesExist(roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      return
    }
    const found = await this.db
      .select({ id: roles.id })
      .from(roles)
      .where(inArray(roles.id, roleIds))
    if (found.length !== roleIds.length) {
      throw new BadRequestException('One or more roles do not exist')
    }
  }

  private async rolesFor(
    adminUserIds: string[],
  ): Promise<Map<string, AdminView['roles']>> {
    const result = new Map<string, AdminView['roles']>()
    if (adminUserIds.length === 0) {
      return result
    }
    const rows = await this.db
      .select({
        adminUserId: adminUserRoles.adminUserId,
        id: roles.id,
        code: roles.code,
        name: roles.name,
      })
      .from(adminUserRoles)
      .innerJoin(roles, eq(adminUserRoles.roleId, roles.id))
      .where(inArray(adminUserRoles.adminUserId, adminUserIds))
    for (const { adminUserId, ...role } of rows) {
      result.set(adminUserId, [...(result.get(adminUserId) ?? []), role])
    }
    return result
  }
}
