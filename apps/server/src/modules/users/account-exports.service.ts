import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { and, count, desc, eq } from 'drizzle-orm'
import {
  pageOffset,
  type PaginationQueryDto,
  type Paginated,
} from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { isUniqueViolation } from '../../database/errors.js'
import {
  accountExports,
  type AccountExportRow,
  type AccountExportStatus,
} from '../../database/schema/index.js'
import { QUEUES } from '../../infra/queue/queue.module.js'
import {
  StorageService,
  type StoredObject,
} from '../../infra/storage/storage.service.js'

export interface AccountExportJob {
  exportId: string
}

export interface AccountExportView {
  id: string
  status: AccountExportStatus
  /** Size of the JSON file once `ready`. */
  sizeBytes: number | null
  createdAt: Date
  completedAt: Date | null
  /** Downloadable until then (ready exports); the file is deleted afterwards. */
  expiresAt: Date | null
}

/** `exports/<userId>/<exportId>.json`; the orphan sweep recognises this shape. */
export function accountExportKey(userId: string, exportId: string): string {
  return `exports/${userId}/${exportId}.json`
}

/**
 * Personal data exports of client users. A request inserts a `pending` row and queues the
 * `account-export` job (`AccountExportProcessor`), which writes the JSON file to storage and emails
 * the user. Files stay downloadable for `ACCOUNT_EXPORT_TTL_HOURS`; the nightly prune deletes them.
 */
@Injectable()
export class AccountExportsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    @InjectQueue(QUEUES.accountExport)
    private readonly queue: Queue<AccountExportJob>,
  ) {}

  /** One export at a time per user (unique partial index); a second request is a 409. */
  async request(userId: string): Promise<AccountExportView> {
    const row = await this.insertPending(userId)
    try {
      await this.queue.add('export', { exportId: row.id }, { jobId: row.id })
    } catch (error) {
      // Without a job the row would block new requests until the nightly prune.
      await this.db.delete(accountExports).where(eq(accountExports.id, row.id))
      throw error
    }
    return toView(row)
  }

  private async insertPending(userId: string): Promise<AccountExportRow> {
    try {
      const [row] = await this.db
        .insert(accountExports)
        .values({ userId })
        .returning()
      return row!
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppException('ACCOUNT_EXPORT_IN_PROGRESS')
      }
      throw error
    }
  }

  async list(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<AccountExportView>> {
    const where = eq(accountExports.userId, userId)
    const [rows, [totals]] = await Promise.all([
      this.db
        .select()
        .from(accountExports)
        .where(where)
        .orderBy(desc(accountExports.createdAt))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(accountExports).where(where),
    ])
    return {
      items: rows.map(toView),
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(userId: string, id: string): Promise<AccountExportView> {
    return toView(await this.getOwned(userId, id))
  }

  /** The file of a ready, unexpired export of the user. */
  async download(
    userId: string,
    id: string,
  ): Promise<{ object: StoredObject; filename: string }> {
    const row = await this.getOwned(userId, id)
    if (row.status !== 'ready' || !row.storageKey) {
      throw new AppException('ACCOUNT_EXPORT_NOT_READY')
    }
    if (!row.expiresAt || row.expiresAt <= new Date()) {
      throw new AppException('ACCOUNT_EXPORT_EXPIRED')
    }
    const object = await this.storage.getObject(row.storageKey)
    return {
      object,
      filename: `account-export-${row.createdAt.toISOString().slice(0, 10)}.json`,
    }
  }

  /** Other users' exports look like missing ones. */
  private async getOwned(
    userId: string,
    id: string,
  ): Promise<AccountExportRow> {
    const [row] = await this.db
      .select()
      .from(accountExports)
      .where(and(eq(accountExports.id, id), eq(accountExports.userId, userId)))
      .limit(1)
    if (!row) {
      throw new AppException('ACCOUNT_EXPORT_NOT_FOUND')
    }
    return row
  }
}

function toView(row: AccountExportRow): AccountExportView {
  return {
    id: row.id,
    status: row.status,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    expiresAt: row.status === 'ready' ? row.expiresAt : null,
  }
}
