import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminController } from '../auth/decorators.js';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto.js';
import { PERMISSIONS } from './permissions.js';
import { RequirePermissions } from './policies.js';
import { RolesService } from './roles.service.js';

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
    }));
  }

  @Get('roles')
  @RequirePermissions('role:read')
  list() {
    return this.roles.list();
  }

  @Get('roles/:id')
  @RequirePermissions('role:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.get(id);
  }

  @Post('roles')
  @RequirePermissions('role:create')
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch('roles/:id')
  @RequirePermissions('role:update')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.roles.update(id, dto);
  }

  @Delete('roles/:id')
  @HttpCode(204)
  @RequirePermissions('role:delete')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.roles.remove(id);
  }
}
