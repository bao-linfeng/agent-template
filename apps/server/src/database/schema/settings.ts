import { jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'
import { adminUsers } from './users.js'

/**
 * Runtime overrides of the settings declared in `src/modules/settings/settings.catalog.ts`. A missing row
 * means the default (usually an env variable); rows whose key the running release does not know are ignored.
 */
export const systemSettings = pgTable('system_settings', {
  key: varchar({ length: 100 }).primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => adminUsers.id, { onDelete: 'set null' }),
  ...timestamps,
})

export type SystemSettingRow = typeof systemSettings.$inferSelect
