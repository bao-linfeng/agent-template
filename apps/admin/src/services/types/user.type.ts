export type UserStatus = 'active' | 'disabled'

/**
 * Fields shared by every account payload. Dates are ISO strings. The admin console signs in with admin
 * accounts (`admin_users`); client app users (`users`) are a separate population managed under `/admin/users`.
 */
export interface IPublicUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

/** `GET /admin/me`: the signed-in admin with role and permission codes. */
export interface IUserProfile extends IPublicUser {
  roles: string[]
  permissions: string[]
}

export interface IRoleSummary {
  id: string
  code: string
  name: string
}

/** Client app users as returned by `/admin/users` (they have no roles). */
export type IClientUser = IPublicUser

/** Admin console accounts as returned by `/admin/admins`. */
export interface IAdminAccount extends IPublicUser {
  roles: IRoleSummary[]
}

export interface ISession {
  id: string
  ip: string | null
  userAgent: string | null
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string
  current: boolean
}
