import { randomUUID } from 'node:crypto'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { and, count, desc, eq } from 'drizzle-orm'
import {
  pageOffset,
  type PaginationQueryDto,
  type Paginated,
} from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { UploadedFile } from '../../common/http/multipart.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { documents, type DocumentRow } from '../../database/schema/index.js'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import {
  parseDocument,
  resolveFormat,
  UnsupportedDocumentError,
} from './document-parsers.js'
import type { KnowledgeBaseView } from './knowledge-bases.service.js'

export interface IngestJob {
  documentId: string
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    @InjectQueue(QUEUES.ragIngest) private readonly queue: Queue<IngestJob>,
  ) {}

  async list(
    kb: KnowledgeBaseView,
    query: PaginationQueryDto,
  ): Promise<Paginated<DocumentRow>> {
    const where = eq(documents.knowledgeBaseId, kb.id)
    const [items, [totals]] = await Promise.all([
      this.db
        .select()
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(documents).where(where),
    ])
    return {
      items,
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(kb: KnowledgeBaseView, documentId: string): Promise<DocumentRow> {
    const document = await this.db.query.documents.findFirst({
      where: and(
        eq(documents.id, documentId),
        eq(documents.knowledgeBaseId, kb.id),
      ),
    })
    if (!document) {
      throw new AppException('DOCUMENT_NOT_FOUND')
    }
    return document
  }

  /** Stores the original file and queues ingestion (parse → chunk → embed). */
  async addFile(
    kb: KnowledgeBaseView,
    userId: string,
    file: UploadedFile,
  ): Promise<DocumentRow> {
    let format: ReturnType<typeof resolveFormat>
    try {
      format = resolveFormat(file.filename)
      // Fail fast on undecodable files instead of in the background job.
      if (!parseDocument(file.buffer, format.mimeType).trim()) {
        throw new UnsupportedDocumentError('File has no text content')
      }
    } catch (error) {
      if (error instanceof UnsupportedDocumentError) {
        throw new AppException('DOCUMENT_UNSUPPORTED', {
          message: error.message,
        })
      }
      throw error
    }
    const title = (file.fields.title?.trim() || file.filename).slice(0, 255)
    return this.store(kb, userId, {
      title,
      source: 'file',
      buffer: file.buffer,
      ...format,
    })
  }

  addText(
    kb: KnowledgeBaseView,
    userId: string,
    title: string,
    content: string,
  ): Promise<DocumentRow> {
    return this.store(kb, userId, {
      title,
      source: 'text',
      buffer: Buffer.from(content, 'utf8'),
      extension: '.md',
      mimeType: 'text/markdown',
    })
  }

  async reindex(
    kb: KnowledgeBaseView,
    documentId: string,
  ): Promise<DocumentRow> {
    await this.get(kb, documentId)
    const [document] = await this.db
      .update(documents)
      .set({ status: 'pending', error: null })
      .where(eq(documents.id, documentId))
      .returning()
    await this.enqueue(documentId)
    return document!
  }

  async remove(kb: KnowledgeBaseView, documentId: string): Promise<void> {
    const document = await this.get(kb, documentId)
    await this.db.delete(documents).where(eq(documents.id, documentId))
    try {
      await this.storage.deleteObject(document.storageKey)
    } catch (error) {
      this.logger.warn(
        `Failed to delete ${document.storageKey}: ${(error as Error).message}`,
      )
    }
  }

  private async store(
    kb: KnowledgeBaseView,
    userId: string,
    input: {
      title: string
      source: 'file' | 'text'
      buffer: Buffer
      extension: string
      mimeType: string
    },
  ): Promise<DocumentRow> {
    const id = randomUUID()
    const storageKey = `rag/${kb.id}/${id}/source${input.extension}`
    await this.storage.putObject(
      storageKey,
      input.buffer,
      `${input.mimeType}; charset=utf-8`,
    )
    const [document] = await this.db
      .insert(documents)
      .values({
        id,
        knowledgeBaseId: kb.id,
        title: input.title,
        source: input.source,
        storageKey,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        createdById: userId,
      })
      .returning()
    await this.enqueue(id)
    return document!
  }

  private async enqueue(documentId: string): Promise<void> {
    await this.queue.add('ingest', { documentId })
  }
}
