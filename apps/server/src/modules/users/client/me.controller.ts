import { Body, HttpCode, Post, Res } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser, HttpReply } from '../../../common/http/request.js'
import type { Env } from '../../../config/env.js'
import { AccountMeController } from '../../accounts/account-me.controller.js'
import {
  AccountsService,
  type PublicAccount,
} from '../../accounts/accounts.service.js'
import { DeleteAccountDto } from '../../accounts/dto/account.dto.js'
import { AuthCookies } from '../../auth/auth-cookies.service.js'
import { ClientController, CurrentUser } from '../../auth/decorators.js'
import { SessionsService } from '../../auth/sessions.service.js'

/** The signed-in client user. Client users have no roles: they can only act on their own data. */
@ApiTags('client / users')
@ClientController('users/me')
export class MeController extends AccountMeController<PublicAccount> {
  constructor(
    accounts: AccountsService,
    sessions: SessionsService,
    config: ConfigService<Env, true>,
    private readonly cookies: AuthCookies,
  ) {
    super(accounts, sessions, config)
  }

  protected profile(user: AuthUser): Promise<PublicAccount> {
    return this.accounts.getPublic('user', user.id)
  }

  /**
   * Requests deletion of the account (password required). Every session ends immediately (cookies are
   * cleared); the account and all its data are purged `ACCOUNT_DELETION_GRACE_DAYS` later unless the
   * owner restores it through `POST /v1/client/auth/restore` before `deletionScheduledAt`.
   */
  @Post('deletion')
  @HttpCode(202)
  async requestDeletion(
    @CurrentUser() user: AuthUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<{ deletionScheduledAt: Date }> {
    const account = await this.accounts.requestDeletion(
      'user',
      user.id,
      dto.password,
    )
    // Bearer clients ignore the cleared cookies; their tokens were revoked with the sessions.
    this.cookies.clear(reply, 'user')
    return { deletionScheduledAt: account.deletionScheduledAt! }
  }
}
