import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import {
  AdminUpdateAccountDto,
  ListAccountsQueryDto,
} from '../../accounts/dto/account.dto.js'
import { AdminController, CurrentUser } from '../../auth/decorators.js'
import { MfaService } from '../../mfa/mfa.service.js'
import { RequirePermissions } from '../../rbac/policies.js'
import { AdminsService } from '../admins.service.js'
import { CreateAdminDto, SetAdminRolesDto } from '../dto/admin.dto.js'

/** Admin console accounts, created and managed by administrators. */
@ApiTags('admin / admins')
@AdminController('admins')
export class AdminsController {
  constructor(
    private readonly admins: AdminsService,
    private readonly mfa: MfaService,
  ) {}

  /** `keyword` matches email or nickname. */
  @Get()
  @RequirePermissions('admin:read')
  list(@Query() query: ListAccountsQueryDto) {
    return this.admins.list(query)
  }

  @Get(':id')
  @RequirePermissions('admin:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.admins.get(id)
  }

  /** Creates an admin account with an initial password; share it with the person out of band. */
  @Post()
  @RequirePermissions('admin:create')
  create(@Body() dto: CreateAdminDto) {
    return this.admins.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('admin:update')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateAccountDto,
  ) {
    return this.admins.update(actor.id, id, dto)
  }

  /** Replaces the admin's roles. */
  @Put(':id/roles')
  @RequirePermissions('admin:update')
  setRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAdminRolesDto,
  ) {
    return this.admins.setRoles(actor.id, id, dto.roleIds)
  }
  /**
   * Removes the admin's two-factor authentication (lost authenticator and recovery codes) and signs
   * them out everywhere. Not allowed on yourself (400 `ADMIN_CANNOT_RESET_OWN_MFA`); 409
   * `MFA_NOT_ENABLED` when it is off.
   */
  @Delete(':id/mfa')
  @HttpCode(204)
  @RequirePermissions('admin:update')
  resetMfa(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.mfa.resetForAdmin(actor.id, id)
  }
}
