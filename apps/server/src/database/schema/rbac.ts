import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './columns.js';
import { users } from './users.js';

export const roles = pgTable('roles', {
  id: uuid().primaryKey().defaultRandom(),
  /** Stable identifier referenced from code (e.g. `super_admin`, `user`). */
  code: varchar({ length: 64 }).notNull().unique(),
  name: varchar({ length: 100 }).notNull(),
  description: text(),
  /** System roles are seeded and cannot be deleted or renamed. */
  isSystem: boolean().notNull().default(false),
  /** Permission codes from `src/modules/rbac/permissions.ts`, e.g. `user:read`. */
  permissions: text().array().notNull().default([]),
  ...timestamps,
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid()
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.roleId] }),
    index().on(table.roleId),
  ],
);

export type RoleRow = typeof roles.$inferSelect;
