import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/** One row per login. The refresh token is `<session id>.<secret>`; only the secret's hash is stored. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text()
      .notNull()
      .unique('password_reset_tokens_token_hash_unique'),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    requestIp: varchar({ length: 64 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.userId)],
);

export type AuthSessionRow = typeof authSessions.$inferSelect;
