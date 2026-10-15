import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.js';

export const userStatus = pgEnum('user_status', ['active', 'disabled']);

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
  ...timestamps,
});

/** Accounts of the client app (self-registered, no roles). */
export const users = pgTable('users', accountColumns());

/** Accounts of the admin console (created by administrators, RBAC roles). Independent of `users`. */
export const adminUsers = pgTable('admin_users', accountColumns());

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserStatus = (typeof userStatus.enumValues)[number];
