import { Injectable } from '@nestjs/common'
import { eq, inArray } from 'drizzle-orm'
import type { Paginated } from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
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
import { MfaService } from '../mfa/mfa.service.js'
import type { AppAbility } from '../rbac/ability.js'
import { SYSTEM_ROLES } from '../rbac/permissions.js'
import { assertCovers } from '../rbac/policies.js'
import { RbacService } from '../rbac/rbac.service.js'
import type { CreateAdminDto } from './dto/admin.dto.js'

/** `GET /v1/admin/me`: the signed-in admin with role and permission codes (build menus from them). */
export interface AdminProfile extends PublicAccount {
  roles: string[]
  permissions: string[]
  /** Two-factor authentication (authenticator app) is enabled; details in `GET /v1/admin/me/mfa`. */
  mfaEnabled: boolean
}

/** Admin accounts as listed in `/v1/admin/admins`. */
export interface AdminView extends PublicAccount {
  roles: { id: string; code: string; name: string }[]
  mfaEnabled: boolean
}

/**
 * Admin console accounts: there is no self-registration, administrators create each other. Nobody
 * may grant roles with permissions they do not hold or manage an admin who has more access than they
 * do (`PERMISSIONS_EXCEED_OWN`), so only super admins create or change super admins.
 */
@Injectable()
export class AdminsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly accounts: AccountsService,
    private readonly rbac: RbacService,
    private readonly mfa: MfaService,
  ) {}

  async getProfile(id: string): Promise<AdminProfile> {
    const account = await this.accounts.getPublic('admin', id)
    return {
      ...account,
      ...(await this.rbac.getAdminAccess(id)),
      mfaEnabled: await this.mfa.isEnabled(id),
    }
  }

  async list(query: ListAccountsQueryDto): Promise<Paginated<AdminView>> {
    const page = await this.accounts.list('admin', query)
    const ids = page.items.map((row) => row.id)
    const [rolesByAdmin, mfaEnabled] = await Promise.all([
      this.rolesFor(ids),
      this.mfa.enabledAmong(ids),
    ])
    return {
      ...page,
      items: page.items.map((row) => ({
        ...this.accounts.toPublic(row),
        roles: rolesByAdmin.get(row.id) ?? [],
        mfaEnabled: mfaEnabled.has(row.id),
      })),
    }
  }

  async get(id: string): Promise<AdminView> {
    const account = await this.accounts.getPublic('admin', id)
    const [rolesByAdmin, mfaEnabled] = await Promise.all([
      this.rolesFor([id]),
      this.mfa.isEnabled(id),
    ])
    return { ...account, roles: rolesByAdmin.get(id) ?? [], mfaEnabled }
  }

  async create(dto: CreateAdminDto, ability: AppAbility): Promise<AdminView> {
    const roleIds = dto.roleIds ?? []
    assertCovers(ability, await this.rbac.permissionsOfRoles(roleIds))
    const admin = await this.db.transaction(async (tx) => {
      const created = await this.accounts.create('admin', dto, tx)
      await this.rbac.assignRoles(created.id, roleIds, tx)
      return created
    })
    return this.get(admin.id)
  }

  async update(
    actorId: string,
    ability: AppAbility,
    id: string,
    dto: AdminUpdateAccountDto,
  ): Promise<AdminView> {
    if (dto.status === 'disabled' && actorId === id) {
      throw new AppException('ADMIN_CANNOT_DISABLE_SELF')
    }
    await this.accounts.getOrThrow('admin', id)
    await this.rbac.assertCanManageAdmin(ability, id)
    await this.accounts.adminUpdate('admin', id, dto)
    return this.get(id)
  }

  /** Replaces the admin's roles. */
  async setRoles(
    actorId: string,
    ability: AppAbility,
    id: string,
    roleIds: string[],
  ): Promise<AdminView> {
    await this.accounts.getOrThrow('admin', id)
    const granted = await this.rbac.permissionsOfRoles(roleIds)
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
        throw new AppException('ADMIN_CANNOT_REMOVE_OWN_SUPER_ADMIN')
      }
    }
    await this.rbac.assertCanManageAdmin(ability, id)
    assertCovers(ability, granted)
    await this.db.transaction((tx) => this.rbac.assignRoles(id, roleIds, tx))
    await this.rbac.invalidateAdmin(id)
    return this.get(id)
  }

  /** Removes the second factor of an admin who lost the device (see `MfaService.resetForAdmin`). */
  async resetMfa(
    actorId: string,
    ability: AppAbility,
    id: string,
  ): Promise<void> {
    if (actorId !== id) {
      await this.rbac.assertCanManageAdmin(ability, id)
    }
    await this.mfa.resetForAdmin(actorId, id)
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
