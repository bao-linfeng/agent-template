export type UserStatus = 'active' | 'disabled'

/** Fields shared by every user payload. Dates are ISO strings. */
export interface IPublicUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

/** `GET /users/me`: the signed-in user with role and permission codes. */
export interface IUserProfile extends IPublicUser {
  roles: string[]
  permissions: string[]
}

export interface IRoleSummary {
  id: string
  code: string
  name: string
}

/** Users as returned by `/admin/users`. */
export interface IAdminUser extends IPublicUser {
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
