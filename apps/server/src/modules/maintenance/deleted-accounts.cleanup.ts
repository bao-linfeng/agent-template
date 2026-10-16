import { Injectable, Logger } from '@nestjs/common'
import { and, asc, eq, inArray, lte, or, sql } from 'drizzle-orm'
import { deleteInBatches } from '../../database/batch-delete.js'
import type { Database, DbExecutor } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import {
  auditLogs,
  chunks,
  knowledgeBases,
  users,
} from '../../database/schema/index.js'
import { mailTemplates } from '../../infra/mail/mail.templates.js'
import { MailService } from '../../infra/mail/mail.service.js'
import { StorageService } from '../../infra/storage/storage.service.js'

/** Accounts purged per transaction (and per audit scrub, which scans `audit_logs`). */
const BATCH_SIZE = 100

interface PurgedAccount {
  id: string
  email: string
  nickname: string
}

/**
 * Purges client users whose deletion grace period ended before `before` (see
 * `AccountsService.scheduleDeletion`). The deletion is final at that point, so the purge may work in
 * steps: it first deletes the large derived data (RAG chunks) in short batches, then the account row in
 * one transaction with the audit scrub, which cascades to sessions, reset tokens, knowledge bases,
 * documents and exports. Files under `avatars/<id>/`, `exports/<id>/` and `rag/<kbId>/` are removed
 * afterwards; anything left behind by a storage outage is caught by the orphan sweep.
 *
 * Audit rows are kept for security, but lose what identifies or describes the person: `actor_email`
 * and `body` of the user's own requests, of anonymous requests that submitted their email (failed
 * logins, registration codes) and of requests on their account (`resource_id`, e.g. admin edits).
 */
@Injectable()
export class DeletedAccountsCleanup {
  private readonly logger = new Logger(DeletedAccountsCleanup.name)

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    private readonly mail: MailService,
  ) {}

  /** Returns how many accounts were purged. */
  async run(before: Date): Promise<number> {
    let purged = 0
    for (;;) {
      const due = await this.db
        .select({ id: users.id })
        .from(users)
        .where(lte(users.deletionScheduledAt, before))
        .orderBy(asc(users.deletionScheduledAt))
        .limit(BATCH_SIZE)
      if (due.length === 0) {
        return purged
      }
      purged += await this.purge(
        due.map((row) => row.id),
        before,
      )
      if (due.length < BATCH_SIZE) {
        return purged
      }
    }
  }

  private async purge(ids: string[], before: Date): Promise<number> {
    const ownedKnowledgeBases = await this.db
      .select({ id: knowledgeBases.id })
      .from(knowledgeBases)
      .where(inArray(knowledgeBases.ownerId, ids))
    const knowledgeBaseIds = ownedKnowledgeBases.map((row) => row.id)
    if (knowledgeBaseIds.length > 0) {
      await deleteInBatches(
        this.db,
        chunks,
        chunks.id,
        inArray(chunks.knowledgeBaseId, knowledgeBaseIds),
      )
    }

    const purged = await this.db.transaction(async (tx) => {
      const rows = await tx
        .delete(users)
        .where(
          and(inArray(users.id, ids), lte(users.deletionScheduledAt, before)),
        )
        .returning({
          id: users.id,
          email: users.email,
          nickname: users.nickname,
        })
      if (rows.length > 0) {
        await this.scrubAuditLogs(tx, rows)
      }
      return rows
    })

    await this.deleteFiles(purged, knowledgeBaseIds)
    for (const account of purged) {
      await this.mail.send(
        account.email,
        mailTemplates.accountDeleted({ nickname: account.nickname }),
      )
    }
    if (purged.length > 0) {
      this.logger.log(`Purged ${purged.length} deleted client accounts`)
    }
    return purged.length
  }

  private async scrubAuditLogs(
    tx: DbExecutor,
    accounts: PurgedAccount[],
  ): Promise<void> {
    const ids = accounts.map((account) => account.id)
    const emails = accounts.map((account) => account.email)
    await tx
      .update(auditLogs)
      .set({ actorEmail: null, body: null })
      .where(
        or(
          inArray(auditLogs.resourceId, ids),
          and(
            eq(auditLogs.realm, 'user'),
            or(
              inArray(auditLogs.actorId, ids),
              inArray(auditLogs.actorEmail, emails),
              inArray(sql`lower(trim(${auditLogs.body} ->> 'email'))`, emails),
            ),
          ),
        ),
      )
  }

  /** Best effort: the orphan sweep deletes whatever a storage outage leaves behind. */
  private async deleteFiles(
    accounts: PurgedAccount[],
    knowledgeBaseIds: string[],
  ): Promise<void> {
    const prefixes = [
      ...accounts.flatMap((account) => [
        `avatars/${account.id}/`,
        `exports/${account.id}/`,
      ]),
      ...knowledgeBaseIds.map((id) => `rag/${id}/`),
    ]
    for (const prefix of prefixes) {
      try {
        await this.storage.deletePrefix(prefix)
      } catch (error) {
        this.logger.warn(
          `Failed to delete objects under ${prefix}: ${(error as Error).message}`,
        )
      }
    }
  }
}
