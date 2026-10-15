import {
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import { AccountMeController } from '../accounts/account-me.controller.js'
import { AccountsService } from '../accounts/accounts.service.js'
import {
  AdminUpdateAccountDto,
  ListAccountsQueryDto,
} from '../accounts/dto/account.dto.js'
import { AdminController, CurrentUser } from '../auth/decorators.js'
import { SessionsService } from '../auth/sessions.service.js'
import { RequirePermissions } from '../rbac/policies.js'
import { AdminsService, type AdminProfile } from './admins.service.js'
import { CreateAdminDto, SetAdminRolesDto } from './dto/admin.dto.js'

/** The signed-in admin: profile with role and permission codes, avatar, password and sessions. */
@ApiTags('admin / me')
@AdminController('me')
export class AdminMeController extends AccountMeController<AdminProfile> {
  constructor(
    private readonly admins: AdminsService,
    accounts: AccountsService,
    sessions: SessionsService,
    config: ConfigService<Env, true>,
  ) {
    super(accounts, sessions, config)
  }

  protected profile(user: AuthUser): Promise<AdminProfile> {
    return this.admins.getProfile(user.id)
  }
}

/** Admin console accounts, created and managed by administrators. */
@ApiTags('admin / admins')
@AdminController('admins')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

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
}
