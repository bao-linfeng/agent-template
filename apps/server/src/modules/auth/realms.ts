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

export interface RealmCookies {
  access: string
  refresh: string
  /** Paths below the API prefix. Without `accessPath` the access token is sent site-wide (`/`). */
  accessPath?: string
  refreshPath: string
}

export const REALM_COOKIES: Record<Realm, RealmCookies> = {
  user: {
    access: 'access_token',
    refresh: 'refresh_token',
    refreshPath: '/auth',
  },
  admin: {
    access: 'admin_access_token',
    refresh: 'admin_refresh_token',
    accessPath: '/admin',
    refreshPath: '/admin/auth',
  },
}
