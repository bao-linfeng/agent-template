import {
  adminPasswordResetTokens,
  adminSessions,
  adminUsers,
  authSessions,
  passwordResetTokens,
  users,
} from '../../database/schema/index.js'

/**
 * Two separate account populations that never share credentials, sessions or cookies:
 * - `user`: client app accounts (`users`), self-registered, ownership-based access only;
 * - `admin`: admin console accounts (`admin_users`), created by administrators, RBAC roles.
 */
export const REALMS = ['user', 'admin'] as const
export type Realm = (typeof REALMS)[number]

export interface RealmTables {
  accounts: typeof users
  sessions: typeof authSessions
  resetTokens: typeof passwordResetTokens
}

/**
 * The admin tables are built by the same factories as the client tables (`schema/users.ts`,
 * `schema/auth.ts`), so the casts only erase the table-name literal from their types.
 */
export const REALM_TABLES: Record<Realm, RealmTables> = {
  user: {
    accounts: users,
    sessions: authSessions,
    resetTokens: passwordResetTokens,
  },
  admin: {
    accounts: adminUsers as unknown as typeof users,
    sessions: adminSessions as unknown as typeof authSessions,
    resetTokens:
      adminPasswordResetTokens as unknown as typeof passwordResetTokens,
  },
}

/** URI version of every realm route (`/<prefix>/v1/...`); public routes such as `/health` are unversioned. */
export const API_VERSION = '1'

/** Route segment of each realm below the version: `/<prefix>/v1/client/...`, `/<prefix>/v1/admin/...`. */
export const REALM_ROUTES: Record<Realm, string> = {
  user: 'client',
  admin: 'admin',
}

/**
 * Realms whose clients may skip cookies: mini-programs and native apps cannot keep HttpOnly cookies, so
 * they send `X-Auth-Transport: bearer` to the credential endpoints, receive the tokens in the body and
 * authenticate with `Authorization: Bearer <access token>`. The admin console is browser-only and
 * stays cookie-only.
 */
export const BEARER_REALMS: ReadonlySet<Realm> = new Set<Realm>(['user'])

const realmBase = (realm: Realm) => `/v${API_VERSION}/${REALM_ROUTES[realm]}`

export interface RealmCookies {
  access: string
  refresh: string
  /** Paths below the API prefix: the access token goes to the realm's routes, the refresh token to its auth routes. */
  accessPath: string
  refreshPath: string
}

export const REALM_COOKIES: Record<Realm, RealmCookies> = {
  user: {
    access: 'access_token',
    refresh: 'refresh_token',
    accessPath: realmBase('user'),
    refreshPath: `${realmBase('user')}/auth`,
  },
  admin: {
    access: 'admin_access_token',
    refresh: 'admin_refresh_token',
    accessPath: realmBase('admin'),
    refreshPath: `${realmBase('admin')}/auth`,
  },
}
