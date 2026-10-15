import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import type { Env } from '../../../config/env.js'
import { AccountMeController } from '../../accounts/account-me.controller.js'
import {
  AccountsService,
  type PublicAccount,
} from '../../accounts/accounts.service.js'
import { ClientController } from '../../auth/decorators.js'
import { SessionsService } from '../../auth/sessions.service.js'

/** The signed-in client user. Client users have no roles: they can only act on their own data. */
@ApiTags('client / users')
@ClientController('users/me')
export class MeController extends AccountMeController<PublicAccount> {
  constructor(
    accounts: AccountsService,
    sessions: SessionsService,
    config: ConfigService<Env, true>,
  ) {
    super(accounts, sessions, config)
  }

  protected profile(user: AuthUser): Promise<PublicAccount> {
    return this.accounts.getPublic('user', user.id)
  }
}
