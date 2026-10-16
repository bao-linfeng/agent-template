export type UserStatus = 'active' | 'disabled'

/**
 * Fields shared by every account payload. Dates are ISO strings. The admin console signs in with admin
 * accounts (`admin_users`); client app users (`users`) are a separate population managed under `/v1/admin/users`.
 */
export interface IPublicUser {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  status: UserStatus
  lastLoginAt: string | null
  /** Client users only: when a pending deletion purges the account (signed out until restored); null otherwise. */
  deletionScheduledAt: string | null
  createdAt: string
}

/** `GET /v1/admin/me`: the signed-in admin with role and permission codes. */
export interface IUserProfile extends IPublicUser {
  roles: string[]
  permissions: string[]
  /** Two-factor authentication (authenticator app) is enabled; details in `GET /v1/admin/me/mfa`. */
  mfaEnabled: boolean
}

export interface IRoleSummary {
  id: string
  code: string
  name: string
}

/** Client app users as returned by `/v1/admin/users` (they have no roles). */
export type IClientUser = IPublicUser

/** Admin console accounts as returned by `/v1/admin/admins`. */
export interface IAdminAccount extends IPublicUser {
  roles: IRoleSummary[]
  mfaEnabled: boolean
}

/** `GET /v1/admin/me/mfa`. */
export interface IMfaStatus {
  totpEnabled: boolean
  enabledAt: string | null
  /** Unused recovery codes left. */
  recoveryCodesRemaining: number
}

/** Pending authenticator setup: show `otpauthUri` as a QR code, `secret` for manual entry. */
export interface ITotpSetup {
  secret: string
  otpauthUri: string
  expiresIn: number
}

/** Shown once after enabling or regenerating; the server only keeps hashes. */
export interface IRecoveryCodes {
  recoveryCodes: string[]
}

/** Answer of `POST /auth/login` for admins with two-factor authentication: no session yet. */
export interface IMfaChallenge {
  mfaRequired: true
  challengeToken: string
  /** Seconds until the password has to be entered again. */
  expiresIn: number
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
