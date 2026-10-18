import { sql } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'
import { adminUsers, users } from './users.js'

/**
 * Personal in-app notifications (`modules/notifications`). Rows store the type code and its parameters,
 * not rendered text: clients translate `notifications.types.<type>` and fall back to the English text the
 * API renders from `notifications.catalog.ts`. Deleted with the account; pruned after
 * `notifications.retentionDays`.
 */
const notificationTable = <N extends string>(
  name: N,
  account: () => AnyPgColumn,
) =>
  pgTable(
    name,
    {
      /** UUIDv7 (PostgreSQL 18): time-ordered, breaks `createdAt` ties in insertion order. */
      id: uuid()
        .primaryKey()
        .default(sql`uuidv7()`),
      recipientId: uuid()
        .notNull()
        .references(account, { onDelete: 'cascade' }),
      /** Key of `NOTIFICATION_TYPES`; rows of types the running release does not know are still listed. */
      type: varchar({ length: 100 }).notNull(),
      params: jsonb().$type<Record<string, unknown>>().notNull().default({}),
      /** App route the notification opens, e.g. `/account`. */
      link: varchar({ length: 500 }),
      readAt: timestamp({ withTimezone: true }),
      createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      index(`${name}_recipient_created_idx`).on(
        table.recipientId,
        table.createdAt.desc(),
      ),
      index(`${name}_unread_idx`)
        .on(table.recipientId)
        .where(sql`${table.readAt} is null`),
      index(`${name}_created_at_idx`).on(table.createdAt),
    ],
  )

/**
 * Overrides of the per-category channel switches (`{ inApp?: boolean, email?: boolean }`); a missing row
 * or key means the channel is on. Mandatory categories ignore these rows.
 */
const preferenceTable = <N extends string>(
  name: N,
  account: () => AnyPgColumn,
) =>
  pgTable(
    name,
    {
      accountId: uuid().notNull().references(account, { onDelete: 'cascade' }),
      /** Key of `NOTIFICATION_CATEGORIES`; rows of unknown categories are ignored. */
      category: varchar({ length: 50 }).notNull(),
      channels: jsonb().$type<Record<string, boolean>>().notNull(),
      updatedAt: timestamp({ withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    },
    (table) => [primaryKey({ columns: [table.accountId, table.category] })],
  )

export const userNotifications = notificationTable(
  'user_notifications',
  () => users.id,
)
export const adminNotifications = notificationTable(
  'admin_notifications',
  () => adminUsers.id,
)
export const userNotificationPreferences = preferenceTable(
  'user_notification_preferences',
  () => users.id,
)
export const adminNotificationPreferences = preferenceTable(
  'admin_notification_preferences',
  () => adminUsers.id,
)

/** `all` reaches both realms. */
export const announcementAudience = pgEnum('announcement_audience', [
  'all',
  'user',
  'admin',
])
export const announcementLevel = pgEnum('announcement_level', [
  'info',
  'warning',
  'critical',
])

/**
 * Announcements written by administrators. Not copied per recipient: visible to the audience while
 * `publishedAt <= now() < expiresAt`, read state lives in the `*_announcement_reads` tables.
 */
export const announcements = pgTable(
  'announcements',
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    title: varchar({ length: 200 }).notNull(),
    /** Plain text; clients render it as text (line breaks kept), never as HTML. */
    body: text().notNull(),
    level: announcementLevel().notNull().default('info'),
    audience: announcementAudience().notNull().default('all'),
    /** Null while a draft. */
    publishedAt: timestamp({ withTimezone: true }),
    /** Hidden from then on; null = until withdrawn or deleted. */
    expiresAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    updatedBy: uuid().references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [index().on(table.publishedAt.desc())],
)

const announcementReadTable = <N extends string>(
  name: N,
  account: () => AnyPgColumn,
) =>
  pgTable(
    name,
    {
      accountId: uuid().notNull().references(account, { onDelete: 'cascade' }),
      announcementId: uuid()
        .notNull()
        .references(() => announcements.id, { onDelete: 'cascade' }),
      readAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
      primaryKey({ columns: [table.accountId, table.announcementId] }),
      index(`${name}_announcement_id_idx`).on(table.announcementId),
    ],
  )

export const userAnnouncementReads = announcementReadTable(
  'user_announcement_reads',
  () => users.id,
)
export const adminAnnouncementReads = announcementReadTable(
  'admin_announcement_reads',
  () => adminUsers.id,
)

export type NotificationRow = typeof userNotifications.$inferSelect
export type AnnouncementRow = typeof announcements.$inferSelect
export type AnnouncementAudience =
  (typeof announcementAudience.enumValues)[number]
export type AnnouncementLevel = (typeof announcementLevel.enumValues)[number]
