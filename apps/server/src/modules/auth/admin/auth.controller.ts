import { ApiTags } from '@nestjs/swagger'
import type { AccountRow } from '../../accounts/accounts.service.js'
import {
  AdminsService,
  type AdminProfile,
} from '../../admins/admins.service.js'
import { AuthCookies } from '../auth-cookies.service.js'
import { AuthService } from '../auth.service.js'
import { CredentialsController } from '../credentials.controller.js'
import { AdminController, Public } from '../decorators.js'
import { SessionsService } from '../sessions.service.js'

/**
 * Admin console accounts (no registration, cookies only). Cookies: `admin_access_token`
 * (path `/<prefix>/v1/admin`), `admin_refresh_token` (path `/<prefix>/v1/admin/auth`).
 */
@ApiTags('admin / auth')
@Public()
@AdminController('auth')
export class AdminAuthController extends CredentialsController<AdminProfile> {
  protected readonly realm = 'admin'

  constructor(
    auth: AuthService,
    cookies: AuthCookies,
    sessions: SessionsService,
    private readonly admins: AdminsService,
  ) {
    super(auth, cookies, sessions)
  }

  protected profile(account: AccountRow): Promise<AdminProfile> {
    return this.admins.getProfile(account.id)
  }
}
