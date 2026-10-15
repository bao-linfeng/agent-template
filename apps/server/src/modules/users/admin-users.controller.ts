import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../../common/http/request.js';
import { CurrentUser } from '../auth/decorators.js';
import { RequirePermissions } from '../rbac/policies.js';
import {
  AdminUpdateUserDto,
  ListUsersQueryDto,
  SetUserRolesDto,
} from './dto/user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('admin / users')
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  /** `keyword` matches email or nickname. */
  @Get()
  @RequirePermissions('user:read')
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions('user:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.adminGet(id);
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.adminUpdate(actor.id, id, dto);
  }

  /** Replaces the user's roles. */
  @Put(':id/roles')
  @RequirePermissions('user:update')
  setRoles(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetUserRolesDto,
  ) {
    return this.users.setRoles(actor.id, id, dto.roleIds);
  }
}
