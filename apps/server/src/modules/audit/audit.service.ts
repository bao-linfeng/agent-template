import { BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from 'drizzle-orm'
import {
  likePattern,
  pageOffset,
  type Paginated,
} from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import {
  auditLogs,
  type AuditLogRow,
  type NewAuditLogRow,
} from '../../database/schema/index.js'
import type { ListAuditLogsQueryDto } from './dto/audit-log.dto.js'

/** Entries are written in batches of at most this size... */
const BATCH_SIZE = 100
/** ...or after this delay, whichever comes first. */
const FLUSH_DELAY_MS = 500
const PRUNE_BATCH_SIZE = 5_000

/**
 * Stores audit entries off the request path: `record` only buffers, batches are inserted after the
 * response and flushed on shutdown. A failed insert is logged and dropped, never surfaced to the caller.
 */
@Injectable()
export class AuditService implements BeforeApplicationShutdown {
  private readonly logger = new Logger(AuditService.name)
  private buffer: NewAuditLogRow[] = []
  private timer?: NodeJS.Timeout
  private writing: Promise<void> = Promise.resolve()

  readonly enabled: boolean
  readonly recordReads: boolean
  readonly retentionDays: number

  constructor(
    @InjectDb() private readonly db: Database,
    config: ConfigService<Env, true>,
  ) {
    this.enabled = config.get('AUDIT_LOG_ENABLED', { infer: true })
    this.recordReads = config.get('AUDIT_LOG_READS', { infer: true })
    this.retentionDays = config.get('AUDIT_LOG_RETENTION_DAYS', {
      infer: true,
    })
  }

  record(entry: NewAuditLogRow): void {
    if (!this.enabled) {
      return
    }
    this.buffer.push(entry)
    if (this.buffer.length >= BATCH_SIZE) {
      void this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), FLUSH_DELAY_MS)
      this.timer.unref()
    }
  }

  /** Resolves once every entry recorded so far is stored (or dropped after a logged failure). */
  flush(): Promise<void> {
    clearTimeout(this.timer)
    this.timer = undefined
    const batch = this.buffer
    this.buffer = []
    if (batch.length > 0) {
      this.writing = this.writing.then(() => this.insert(batch))
    }
    return this.writing
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.flush()
  }

  private async insert(batch: NewAuditLogRow[]): Promise<void> {
    try {
      await this.db.insert(auditLogs).values(batch)
    } catch (error) {
      this.logger.error(
        `Failed to write ${batch.length} audit log entries: ${(error as Error).message}`,
      )
    }
  }

  /** Newest first. `keyword` matches the actor email, action and path. */
  async list(query: ListAuditLogsQueryDto): Promise<Paginated<AuditLogRow>> {
    const filters: SQL[] = []
    if (query.keyword) {
      const pattern = likePattern(query.keyword)
      filters.push(
        or(
          ilike(auditLogs.actorEmail, pattern),
          ilike(auditLogs.action, pattern),
          ilike(auditLogs.path, pattern),
        )!,
      )
    }
    if (query.realm) {
      filters.push(eq(auditLogs.realm, query.realm))
    }
    if (query.actorId) {
      filters.push(eq(auditLogs.actorId, query.actorId))
    }
    if (query.action) {
      filters.push(eq(auditLogs.action, query.action))
    }
    if (query.method) {
      filters.push(eq(auditLogs.method, query.method))
    }
    if (query.resourceId) {
      filters.push(eq(auditLogs.resourceId, query.resourceId))
    }
    if (query.outcome) {
      filters.push(
        query.outcome === 'success'
          ? lt(auditLogs.statusCode, 400)
          : gte(auditLogs.statusCode, 400),
      )
    }
    if (query.from) {
      filters.push(gte(auditLogs.createdAt, query.from))
    }
    if (query.to) {
      filters.push(lt(auditLogs.createdAt, query.to))
    }
    const where = filters.length > 0 ? and(...filters) : undefined
    const [items, [totals]] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(auditLogs).where(where),
    ])
    return {
      items,
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(id: string): Promise<AuditLogRow> {
    const [row] = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
    if (!row) {
      throw new AppException('AUDIT_LOG_NOT_FOUND')
    }
    return row
  }

  /** Deletes entries created before `before` in small batches (short locks); returns the count. */
  async prune(before: Date): Promise<number> {
    let total = 0
    for (;;) {
      const expired = this.db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(lt(auditLogs.createdAt, before))
        .limit(PRUNE_BATCH_SIZE)
      const result = await this.db
        .delete(auditLogs)
        .where(inArray(auditLogs.id, expired))
      const deleted = result.rowCount ?? 0
      total += deleted
      if (deleted < PRUNE_BATCH_SIZE) {
        return total
      }
    }
  }
}
