import { inArray, type SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type { Database } from './database.js'

const DEFAULT_BATCH_SIZE = 5_000

/**
 * Deletes the rows matching `where` in batches of `batchSize` primary keys, so housekeeping jobs never
 * hold long locks on hot tables. Returns the number of deleted rows.
 */
export async function deleteInBatches(
  db: Database,
  table: PgTable,
  id: PgColumn,
  where: SQL | undefined,
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<number> {
  let total = 0
  for (;;) {
    const batch = db.select({ id }).from(table).where(where).limit(batchSize)
    const result = await db.delete(table).where(inArray(id, batch))
    const deleted = result.rowCount ?? 0
    total += deleted
    if (deleted < batchSize) {
      return total
    }
  }
}
