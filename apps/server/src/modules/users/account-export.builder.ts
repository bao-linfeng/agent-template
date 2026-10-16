import { Injectable } from '@nestjs/common'
import { and, asc, eq, gt, type SQL } from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import { AppException } from '../../common/errors/app.exception.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import {
  auditLogs,
  authSessions,
  documents,
  embeddingModels,
  knowledgeBases,
  users,
} from '../../database/schema/index.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import { detectImageType } from '../accounts/avatar.js'
import { JsonObjectFileWriter } from './json-file-writer.js'

/** Identifies the file format; bump `version` when fields are renamed or removed. */
export const ACCOUNT_EXPORT_FORMAT = {
  format: 'agent-template/account-export',
  version: 1,
} as const

const PAGE_SIZE = 500
/** Documents are read with their content, so fewer per page. */
const DOCUMENT_PAGE_SIZE = 50

/** Source files of these types are exported as text; anything else as base64. */
function isTextType(mimeType: string): boolean {
  return mimeType.startsWith('text/') || mimeType === 'application/json'
}

/**
 * Builds the personal data export of a client user: one JSON file with the profile, avatar, sign-in
 * sessions, knowledge bases with their source documents and the user's own audit trail. Derived data
 * (text chunks, embeddings) is left out; it is rebuilt from the documents.
 */
@Injectable()
export class AccountExportBuilder {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async write(userId: string, path: string): Promise<void> {
    const [account] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!account) {
      throw new AppException('ACCOUNT_NOT_FOUND')
    }
    const writer = new JsonObjectFileWriter(path)
    try {
      await writer.field('format', ACCOUNT_EXPORT_FORMAT.format)
      await writer.field('version', ACCOUNT_EXPORT_FORMAT.version)
      await writer.field('exportedAt', new Date())
      await writer.field('account', {
        id: account.id,
        email: account.email,
        nickname: account.nickname,
        status: account.status,
        lastLoginAt: account.lastLoginAt,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })
      await writer.field('avatar', await this.avatar(account.avatarKey))
      await writer.array('sessions', this.sessions(userId))
      await writer.array('knowledgeBases', this.knowledgeBases(userId))
      await writer.array('documents', this.documents(userId))
      await writer.array('auditLogs', this.auditLogs(userId))
      await writer.close()
    } catch (error) {
      writer.destroy()
      throw error
    }
  }

  private async avatar(key: string | null) {
    if (!key) {
      return null
    }
    try {
      const buffer = await this.storage.getObjectBuffer(key)
      return {
        mimeType: detectImageType(buffer)?.mime ?? 'application/octet-stream',
        base64: buffer.toString('base64'),
      }
    } catch (error) {
      if (error instanceof AppException && error.code === 'FILE_NOT_FOUND') {
        return null
      }
      throw error
    }
  }

  private async *sessions(userId: string) {
    yield* await this.db
      .select({
        createdAt: authSessions.createdAt,
        lastUsedAt: authSessions.lastUsedAt,
        expiresAt: authSessions.expiresAt,
        revokedAt: authSessions.revokedAt,
        ip: authSessions.ip,
        userAgent: authSessions.userAgent,
      })
      .from(authSessions)
      .where(eq(authSessions.userId, userId))
      .orderBy(asc(authSessions.createdAt))
  }

  private async *knowledgeBases(userId: string) {
    yield* await this.db
      .select({
        id: knowledgeBases.id,
        name: knowledgeBases.name,
        description: knowledgeBases.description,
        embeddingModel: embeddingModels.model,
        chunkSize: knowledgeBases.chunkSize,
        chunkOverlap: knowledgeBases.chunkOverlap,
        createdAt: knowledgeBases.createdAt,
        updatedAt: knowledgeBases.updatedAt,
      })
      .from(knowledgeBases)
      .innerJoin(
        embeddingModels,
        eq(knowledgeBases.embeddingModelId, embeddingModels.id),
      )
      .where(eq(knowledgeBases.ownerId, userId))
      .orderBy(asc(knowledgeBases.createdAt))
  }

  private async *documents(userId: string) {
    const pages = keysetPages(documents.id, DOCUMENT_PAGE_SIZE, (after) =>
      this.db
        .select({
          id: documents.id,
          knowledgeBaseId: documents.knowledgeBaseId,
          title: documents.title,
          source: documents.source,
          mimeType: documents.mimeType,
          sizeBytes: documents.sizeBytes,
          status: documents.status,
          storageKey: documents.storageKey,
          createdAt: documents.createdAt,
          updatedAt: documents.updatedAt,
        })
        .from(documents)
        .innerJoin(
          knowledgeBases,
          eq(documents.knowledgeBaseId, knowledgeBases.id),
        )
        .where(and(eq(knowledgeBases.ownerId, userId), after))
        .orderBy(asc(documents.id))
        .limit(DOCUMENT_PAGE_SIZE),
    )
    for await (const { storageKey, ...document } of pages) {
      yield {
        ...document,
        ...(await this.content(storageKey, document.mimeType)),
      }
    }
  }

  private async content(key: string, mimeType: string) {
    try {
      const buffer = await this.storage.getObjectBuffer(key)
      return isTextType(mimeType)
        ? { content: buffer.toString('utf8') }
        : { contentBase64: buffer.toString('base64') }
    } catch (error) {
      if (error instanceof AppException && error.code === 'FILE_NOT_FOUND') {
        return { content: null }
      }
      throw error
    }
  }

  private auditLogs(userId: string) {
    // UUIDv7 ids are time-ordered, so paging by id lists the trail chronologically.
    return keysetPages(auditLogs.id, PAGE_SIZE, (after) =>
      this.db
        .select({
          id: auditLogs.id,
          createdAt: auditLogs.createdAt,
          action: auditLogs.action,
          method: auditLogs.method,
          path: auditLogs.path,
          statusCode: auditLogs.statusCode,
          errorCode: auditLogs.errorCode,
          ip: auditLogs.ip,
          userAgent: auditLogs.userAgent,
        })
        .from(auditLogs)
        .where(
          and(
            eq(auditLogs.realm, 'user'),
            eq(auditLogs.actorId, userId),
            after,
          ),
        )
        .orderBy(asc(auditLogs.id))
        .limit(PAGE_SIZE),
    )
  }
}

/**
 * Pages through rows ordered by a unique `id` column (`after` is the condition `id > <last id>`).
 * Keyset paging stays fast on large tables and never repeats or skips rows.
 */
async function* keysetPages<T extends { id: string }>(
  id: PgColumn,
  pageSize: number,
  fetch: (after: SQL | undefined) => Promise<T[]>,
): AsyncGenerator<T> {
  let last: string | undefined
  for (;;) {
    const rows = await fetch(last === undefined ? undefined : gt(id, last))
    yield* rows
    if (rows.length < pageSize) {
      return
    }
    last = rows.at(-1)!.id
  }
}
