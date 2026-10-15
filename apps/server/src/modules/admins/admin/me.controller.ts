import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import type { Env } from '../../../config/env.js'
import { AccountMeController } from '../../accounts/account-me.controller.js'
import { AccountsService } from '../../accounts/accounts.service.js'
import { AdminController } from '../../auth/decorators.js'
import { SessionsService } from '../../auth/sessions.service.js'
import { AdminsService, type AdminProfile } from '../admins.service.js'

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
