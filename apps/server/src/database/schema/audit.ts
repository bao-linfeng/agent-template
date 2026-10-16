import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * One row per audited API request (see `modules/audit`). Append-only: rows are only deleted by the
 * retention job, and only updated by the account purge, which clears `actor_email` and `body` of rows
 * about a deleted client user. Actor columns are copied instead of referenced, so the trail survives
 * renamed or deleted accounts.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    /** UUIDv7 (PostgreSQL 18): time-ordered, breaks `createdAt` ties in insertion order. */
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    /** `user` (client app) or `admin` (admin console); null for realm-less public routes. */
    realm: varchar({ length: 16 }).$type<'user' | 'admin'>(),
    /** `users.id` or `admin_users.id` depending on `realm`; null for anonymous requests (e.g. failed logins). */
    actorId: uuid(),
    /** Signed-in email, or the email submitted to a public credential route. */
    actorEmail: varchar({ length: 255 }),
    /** `<Controller>.<handler>` unless overridden with `@Audit({ action })`, e.g. `RolesController.update`. */
    action: varchar({ length: 200 }).notNull(),
    method: varchar({ length: 10 }).notNull(),
    /** Route pattern, e.g. `/api/v1/admin/roles/:id`. */
    route: text().notNull(),
    /** Requested path without the query string. */
    path: text().notNull(),
    /** `:id` route parameter, or the `id` of the created record. */
    resourceId: varchar({ length: 100 }),
    params: jsonb().$type<Record<string, unknown>>(),
    /** Sanitized query string and body (secrets redacted, long values truncated). */
    query: jsonb().$type<Record<string, unknown>>(),
    body: jsonb().$type<unknown>(),
    statusCode: integer().notNull(),
    /** `code` of the error response (`ERRORS`), null on success. */
    errorCode: varchar({ length: 64 }),
    durationMs: integer().notNull(),
    ip: varchar({ length: 64 }),
    userAgent: text(),
    /** `x-request-id` of the request, also present in the HTTP logs. */
    requestId: varchar({ length: 100 }),
    /** When the response finished (set by the writer; batch inserts would share one `now()`). */
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index().on(table.createdAt.desc()),
    index().on(table.actorId, table.createdAt.desc()),
    index().on(table.action, table.createdAt.desc()),
    index()
      .on(table.resourceId)
      .where(sql`${table.resourceId} is not null`),
  ],
)

export type AuditLogRow = typeof auditLogs.$inferSelect
export type NewAuditLogRow = typeof auditLogs.$inferInsert
