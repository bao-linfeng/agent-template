import {
  Body,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  AdminUpdateAccountDto,
  ListAccountsQueryDto,
} from '../../accounts/dto/account.dto.js'
import { AccountsService } from '../../accounts/accounts.service.js'
import { AdminController } from '../../auth/decorators.js'
import { RequirePermissions } from '../../rbac/policies.js'

/** Client users as seen from the admin console (view, rename, enable/disable, schedule/cancel deletion). */
@ApiTags('admin / users')
@AdminController('users')
export class AdminUsersController {
  constructor(private readonly accounts: AccountsService) {}

  /** `keyword` matches email or nickname; `deletion=pending` lists accounts scheduled for deletion. */
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

  /**
   * Schedules the deletion of a client user on their behalf (same grace period as self-service) and
   * signs them out. The owner can still restore the account by signing in; disable it as well to
   * prevent that.
   */
  @Post(':id/deletion')
  @RequirePermissions('user:delete')
  async scheduleDeletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.toPublic(
      await this.accounts.scheduleDeletion('user', id),
    )
  }

  /** Cancels a pending deletion; the user can sign in again. */
  @Delete(':id/deletion')
  @RequirePermissions('user:delete')
  async cancelDeletion(@Param('id', ParseUUIDPipe) id: string) {
    return this.accounts.toPublic(
      await this.accounts.cancelDeletion('user', id),
    )
  }
}
