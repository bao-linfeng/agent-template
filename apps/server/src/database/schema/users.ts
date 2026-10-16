import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'

export const userStatus = pgEnum('user_status', ['active', 'disabled'])

/**
 * Columns of an account table. Client users and admin console accounts are two separate populations
 * with identical columns, so the auth code can work on either table (see `modules/auth/realms.ts`).
 */
const accountColumns = () => ({
  id: uuid().primaryKey().defaultRandom(),
  /** Always stored trimmed and lower-cased. */
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text().notNull(),
  nickname: varchar({ length: 50 }).notNull(),
  /** Object key in storage; resolve to a URL with `AccountsService.toPublicAccount`. */
  avatarKey: text(),
  status: userStatus().notNull().default('active'),
  lastLoginAt: timestamp({ withTimezone: true }),
  /**
   * Soft deletion (client users only): set when deletion is requested, which signs the account out
   * everywhere. Until `deletionScheduledAt` the account can be restored; then the nightly purge deletes
   * it with all its data. Both are null for live accounts.
   */
  deletionRequestedAt: timestamp({ withTimezone: true }),
  deletionScheduledAt: timestamp({ withTimezone: true }),
  ...timestamps,
})

/** Accounts of the client app (self-registered, no roles). */
export const users = pgTable('users', accountColumns(), (table) => [
  index('users_deletion_scheduled_at_idx')
    .on(table.deletionScheduledAt)
    .where(sql`${table.deletionScheduledAt} is not null`),
])

/** Accounts of the admin console (created by administrators, RBAC roles). Independent of `users`. */
export const adminUsers = pgTable('admin_users', accountColumns())

export const accountExportStatus = pgEnum('account_export_status', [
  'pending',
  'processing',
  'ready',
  'failed',
])

/**
 * Personal data exports of client users (`modules/users`). The file lives in storage at
 * `exports/<userId>/<exportId>.json` until `expiresAt`; the nightly prune deletes row and file.
 */
export const accountExports = pgTable(
  'account_exports',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: accountExportStatus().notNull().default('pending'),
    storageKey: text(),
    sizeBytes: integer(),
    /** Internal failure reason; not shown to users. */
    error: text(),
    completedAt: timestamp({ withTimezone: true }),
    /** Set when the export finished (ready or failed). */
    expiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index().on(table.userId, table.createdAt.desc()),
    index().on(table.expiresAt),
    // At most one export per user is being built at a time.
    uniqueIndex('account_exports_active_unique')
      .on(table.userId)
      .where(sql`${table.status} in ('pending', 'processing')`),
  ],
)

export type UserRow = typeof users.$inferSelect
export type NewUserRow = typeof users.$inferInsert
export type UserStatus = (typeof userStatus.enumValues)[number]
export type AccountExportRow = typeof accountExports.$inferSelect
export type AccountExportStatus =
  (typeof accountExportStatus.enumValues)[number]
