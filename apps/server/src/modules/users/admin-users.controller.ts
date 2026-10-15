import { Body, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AdminUpdateAccountDto,
  ListAccountsQueryDto,
} from '../accounts/dto/account.dto.js'
import { AccountsService } from '../accounts/accounts.service.js'
import { AdminController } from '../auth/decorators.js'
import { RequirePermissions } from '../rbac/policies.js'

/** Client users as seen from the admin console (view, rename, enable/disable). */
@ApiTags('admin / users')
@AdminController('users')
export class AdminUsersController {
  constructor(private readonly accounts: AccountsService) {}

  /** `keyword` matches email or nickname. */
  @Get()
  @RequirePermissions('user:read')
  async list(@Query() query: ListAccountsQueryDto) {
    const page = await this.accounts.list('user', query)
    return {
      ...page,
      items: page.items.map((row) => this.accounts.toPublic(row)),
    }
  }

  @Get(':id')
  @RequirePermissions('user:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.getPublic('user', id)
  }

  @Patch(':id')
  @RequirePermissions('user:update')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateAccountDto,
  ) {
    await this.accounts.adminUpdate('user', id, dto)
    return this.accounts.getPublic('user', id)
  }
}
