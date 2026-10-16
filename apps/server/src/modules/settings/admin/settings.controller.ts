import { Body, Get, Patch } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import { AdminController, CurrentUser } from '../../auth/decorators.js'
import { RequirePermissions } from '../../rbac/policies.js'
import { UpdateSettingsDto } from '../dto/settings.dto.js'
import { SettingsService } from '../settings.service.js'

/** Runtime settings and feature flags; changes apply to every instance without a restart. */
@ApiTags('admin / settings')
@AdminController('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Every setting with its effective value, default, schema and last change. */
  @Get()
  @RequirePermissions('setting:read')
  list() {
    return this.settings.list()
  }

  @Patch()
  @RequirePermissions('setting:manage')
  update(@Body() dto: UpdateSettingsDto, @CurrentUser() actor: AuthUser) {
    return this.settings.update(dto.values, actor.id)
  }
}
