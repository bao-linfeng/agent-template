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

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** Always stored trimmed and lower-cased. */
  email: varchar({ length: 255 }).notNull().unique(),
  passwordHash: text().notNull(),
  nickname: varchar({ length: 50 }).notNull(),
  /** Object key in storage; resolve to a URL with `UsersService.toPublicUser`. */
  avatarKey: text(),
  status: userStatus().notNull().default('active'),
  lastLoginAt: timestamp({ withTimezone: true }),
  ...timestamps,
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type UserStatus = (typeof userStatus.enumValues)[number];
