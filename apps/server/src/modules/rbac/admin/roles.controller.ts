import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminController } from '../../auth/decorators.js'
import { CreateRoleDto, UpdateRoleDto } from '../dto/role.dto.js'
import type { AppAbility } from '../ability.js'
import { PERMISSIONS } from '../permissions.js'
import { CurrentAbility, RequirePermissions } from '../policies.js'
import { RolesService } from '../roles.service.js'

/**
 * Roles of admin console accounts. Creating, editing and deleting a role needs every permission it has
 * or gets (403 `PERMISSIONS_EXCEED_OWN`), so only super admins touch `super_admin`.
 */
@ApiTags('admin / roles')
@AdminController()
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  /** Permission catalog for building role editors. */
  @Get('permissions')
  @RequirePermissions('role:read')
  listPermissions() {
    return Object.entries(PERMISSIONS).map(([code, description]) => ({
      code,
      description,
    }))
  }

  @Get('roles')
  @RequirePermissions('role:read')
  list() {
    return this.roles.list()
  }

  @Get('roles/:id')
  @RequirePermissions('role:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.get(id)
  }

  @Post('roles')
  @RequirePermissions('role:create')
  create(@Body() dto: CreateRoleDto, @CurrentAbility() ability: AppAbility) {
    return this.roles.create(dto, ability)
  }

  @Patch('roles/:id')
  @RequirePermissions('role:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentAbility() ability: AppAbility,
  ) {
    return this.roles.update(id, dto, ability)
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermissions('role:delete')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentAbility() ability: AppAbility,
  ) {
    await this.roles.remove(id, ability)
  }
}
