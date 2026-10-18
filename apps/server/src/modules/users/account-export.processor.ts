import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { Env } from '../../config/env.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { accountExports, users } from '../../database/schema/index.js'
import { mailTemplates } from '../../infra/mail/mail.templates.js'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import { NotificationsService } from '../notifications/notifications.service.js'
import { AccountExportBuilder } from './account-export.builder.js'
import {
  accountExportKey,
  type AccountExportJob,
} from './account-exports.service.js'

const HOUR_MS = 60 * 60 * 1000

/**
 * Builds a requested export into a temporary file, uploads it to `exports/<userId>/<exportId>.json`
 * and notifies the user (in-app and by email, as the user's preferences allow). Transient failures
 * are retried by BullMQ; after the last attempt the export is `failed` and the user can request a new
 * one. A failed notification is only logged: the export is ready either way, and retrying would build
 * it again and notify twice.
 */
@Processor(QUEUES.accountExport)
export class AccountExportProcessor extends WorkerHost {
  private readonly logger = new Logger(AccountExportProcessor.name)
  private readonly ttlMs: number

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly builder: AccountExportBuilder,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
    config: ConfigService<Env, true>,
  ) {
    super()
    this.ttlMs =
      config.get('ACCOUNT_EXPORT_TTL_HOURS', { infer: true }) * HOUR_MS
  }

  async process(job: Job<AccountExportJob>): Promise<void> {
    const { exportId } = job.data
    const [row] = await this.db
      .select({
        userId: accountExports.userId,
        status: accountExports.status,
        email: users.email,
        nickname: users.nickname,
      })
      .from(accountExports)
      .innerJoin(users, eq(accountExports.userId, users.id))
      .where(eq(accountExports.id, exportId))
      .limit(1)
    if (!row || row.status === 'ready' || row.status === 'failed') {
      return // Deleted with its account, or already finished.
    }

    const path = join(
      tmpdir(),
      `account-export-${exportId}-${randomUUID()}.json`,
    )
    let expiresAt: Date
    try {
      await this.db
        .update(accountExports)
        .set({ status: 'processing', error: null })
        .where(eq(accountExports.id, exportId))
      await this.builder.write(row.userId, path)
      const key = accountExportKey(row.userId, exportId)
      const sizeBytes = await this.storage.putFile(
        key,
        path,
        'application/json; charset=utf-8',
      )
      const completedAt = new Date()
      expiresAt = new Date(completedAt.getTime() + this.ttlMs)
      await this.db
        .update(accountExports)
        .set({
          status: 'ready',
          storageKey: key,
          sizeBytes,
          completedAt,
          expiresAt,
        })
        .where(eq(accountExports.id, exportId))
      this.logger.log(`Export ${exportId} ready (${sizeBytes} bytes)`)
    } catch (error) {
      const finalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      const now = new Date()
      await this.db
        .update(accountExports)
        .set(
          finalAttempt
            ? {
                status: 'failed',
                error: (error as Error).message.slice(0, 1000),
                completedAt: now,
                expiresAt: new Date(now.getTime() + this.ttlMs),
              }
            : {
                status: 'pending',
                error: (error as Error).message.slice(0, 1000),
              },
        )
        .where(eq(accountExports.id, exportId))
      throw error
    } finally {
      await rm(path, { force: true })
    }

    try {
      await this.notifications.notify({
        realm: 'user',
        recipientId: row.userId,
        type: 'account.exportReady',
        params: { exportId, expiresAt: expiresAt.toISOString() },
        mail: {
          to: row.email,
          ...mailTemplates.accountExportReady({
            nickname: row.nickname,
            expiresAt,
          }),
        },
      })
    } catch (error) {
      this.logger.warn(
        `Could not notify user ${row.userId} about export ${exportId}: ${(error as Error).message}`,
      )
    }
  }
}
