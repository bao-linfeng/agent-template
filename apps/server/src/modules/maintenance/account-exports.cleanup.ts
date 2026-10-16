import { Injectable, Logger } from '@nestjs/common'
import { and, inArray, lt, or } from 'drizzle-orm'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { accountExports } from '../../database/schema/index.js'
import { StorageService } from '../../infra/storage/storage.service.js'

const BATCH_SIZE = 500
/** Exports still pending/processing after this long lost their job (e.g. Redis was flushed). */
export const STALE_EXPORT_MS = 24 * 60 * 60 * 1000

/**
 * Deletes personal data exports that expired before `before` (ready or failed ones get `expiresAt`
 * when they finish) and exports stuck unfinished for `STALE_EXPORT_MS`, which would otherwise block
 * new requests. Rows go first, then their files; files a storage outage leaves behind are caught by the
 * orphan sweep.
 */
@Injectable()
export class AccountExportsCleanup {
  private readonly logger = new Logger(AccountExportsCleanup.name)

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async run(before: Date): Promise<number> {
    const staleBefore = new Date(before.getTime() - STALE_EXPORT_MS)
    const where = or(
      lt(accountExports.expiresAt, before),
      and(
        inArray(accountExports.status, ['pending', 'processing']),
        lt(accountExports.createdAt, staleBefore),
      ),
    )
    let deleted = 0
    for (;;) {
      const rows = await this.db
        .delete(accountExports)
        .where(
          inArray(
            accountExports.id,
            this.db
              .select({ id: accountExports.id })
              .from(accountExports)
              .where(where)
              .limit(BATCH_SIZE),
          ),
        )
        .returning({ storageKey: accountExports.storageKey })
      deleted += rows.length
      const keys = rows.flatMap((row) =>
        row.storageKey ? [row.storageKey] : [],
      )
      if (keys.length > 0) {
        try {
          await this.storage.deleteObjects(keys)
        } catch (error) {
          this.logger.warn(
            `Failed to delete ${keys.length} export files: ${(error as Error).message}`,
          )
        }
      }
      if (rows.length < BATCH_SIZE) {
        return deleted
      }
    }
  }
}
