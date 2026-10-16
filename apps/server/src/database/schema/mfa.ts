import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'
import { adminUsers } from './users.js'

/**
 * Authenticator-app (TOTP) second factor of admin console accounts (`modules/mfa`). A row exists only
 * while TOTP is enabled; pending setups live in Redis until confirmed.
 */
export const adminTotpCredentials = pgTable('admin_totp_credentials', {
  adminUserId: uuid()
    .primaryKey()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  /** Base32 secret encrypted with `SecretBox` (`ENCRYPTION_KEY`). */
  secretEncrypted: text().notNull(),
  /** Time step of the last accepted code; codes of this or an older step are rejected (no replay). */
  lastUsedStep: bigint({ mode: 'number' }),
  ...timestamps,
})

/** One-time recovery codes for admins who lost their authenticator; only hashes are stored. */
export const adminRecoveryCodes = pgTable(
  'admin_recovery_codes',
  {
    id: uuid().primaryKey().defaultRandom(),
    adminUserId: uuid()
      .notNull()
      .references(() => adminUsers.id, { onDelete: 'cascade' }),
    codeHash: text().notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.adminUserId)],
)

export type AdminTotpCredentialRow = typeof adminTotpCredentials.$inferSelect
