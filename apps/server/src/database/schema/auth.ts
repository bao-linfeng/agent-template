import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { adminUsers, users } from './users.js';

/** One row per login. The refresh token is `<session id>.<secret>`; only the secret's hash is stored. */
const sessionTable = <N extends string>(name: N, account: () => AnyPgColumn) =>
  pgTable(
    name,
    {
      id: uuid().primaryKey().defaultRandom(),
      userId: uuid().notNull().references(account, { onDelete: 'cascade' }),
      refreshTokenHash: text().notNull(),
      /** Hash replaced by the latest rotation; reuse outside the grace window revokes the session. */
      previousRefreshTokenHash: text(),
      rotatedAt: timestamp({ withTimezone: true }),
      userAgent: text(),
      ip: varchar({ length: 64 }),
      expiresAt: timestamp({ withTimezone: true }).notNull(),
      revokedAt: timestamp({ withTimezone: true }),
      lastUsedAt: timestamp({ withTimezone: true }),
      createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index().on(table.userId)],
  );

const passwordResetTable = <N extends string>(
  name: N,
  account: () => AnyPgColumn,
) =>
  pgTable(
    name,
    {
      id: uuid().primaryKey().defaultRandom(),
      userId: uuid().notNull().references(account, { onDelete: 'cascade' }),
      tokenHash: text().notNull().unique(`${name}_token_hash_unique`),
      expiresAt: timestamp({ withTimezone: true }).notNull(),
      usedAt: timestamp({ withTimezone: true }),
      requestIp: varchar({ length: 64 }),
      createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [index().on(table.userId)],
  );

export const authSessions = sessionTable('auth_sessions', () => users.id);
export const passwordResetTokens = passwordResetTable(
  'password_reset_tokens',
  () => users.id,
);

/** Same shape as the client tables; `user_id` references `admin_users`. */
export const adminSessions = sessionTable(
  'admin_sessions',
  () => adminUsers.id,
);
export const adminPasswordResetTokens = passwordResetTable(
  'admin_password_reset_tokens',
  () => adminUsers.id,
);

export type AuthSessionRow = typeof authSessions.$inferSelect;
