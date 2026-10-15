import { customType, timestamp } from 'drizzle-orm/pg-core';

/** `created_at` / `updated_at` pair shared by mutable tables. */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * pgvector column without a fixed dimension, so one table can hold embeddings from models with
 * different dimensions. Rows carry their dimension in a sibling column; ANN indexes are partial
 * expression indexes per dimension (see `ensureVectorIndex`).
 */
export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector';
  },
  toDriver(value) {
    return toVectorLiteral(value);
  },
  fromDriver(value) {
    return JSON.parse(value) as number[];
  },
});

export function toVectorLiteral(value: readonly number[]): string {
  return `[${value.join(',')}]`;
}
