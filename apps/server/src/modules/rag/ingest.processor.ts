import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { UnrecoverableError, type Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { chunks, documents } from '../../database/schema/index.js'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import { EmbeddingClient } from '../ai/embedding-client.js'
import { EmbeddingModelsService } from '../ai/embedding-models.service.js'
import { parseDocument, UnsupportedDocumentError } from './document-parsers.js'
import type { IngestJob } from './documents.service.js'
import { splitText } from './text-splitter.js'

const INSERT_BATCH = 500

/** parse → chunk → embed → replace chunks. Transient failures (provider down) are retried by BullMQ. */
@Processor(QUEUES.ragIngest, { concurrency: 2 })
export class IngestProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestProcessor.name)

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly storage: StorageService,
    private readonly models: EmbeddingModelsService,
    private readonly embeddings: EmbeddingClient,
  ) {
    super()
  }

  async process(job: Job<IngestJob>): Promise<void> {
    const { documentId } = job.data
    const document = await this.db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: { knowledgeBase: true },
    })
    if (!document) {
      return // Deleted while queued.
    }
    const kb = document.knowledgeBase

    try {
      await this.db
        .update(documents)
        .set({ status: 'processing', error: null })
        .where(eq(documents.id, documentId))
      const model = await this.models.get(kb.embeddingModelId)
      if (!model.enabled) {
        throw new UnrecoverableError(
          `Embedding model "${model.name}" is disabled`,
        )
      }

      let text: string
      try {
        text = parseDocument(
          await this.storage.getObjectBuffer(document.storageKey),
          document.mimeType,
        )
      } catch (error) {
        throw error instanceof UnsupportedDocumentError
          ? new UnrecoverableError(error.message)
          : error
      }
      const pieces = splitText(text, {
        chunkSize: kb.chunkSize,
        chunkOverlap: kb.chunkOverlap,
      })
      if (pieces.length === 0) {
        throw new UnrecoverableError('Document has no text content')
      }
      const vectors = await this.embeddings.embed(
        this.models.toTarget(model),
        pieces,
      )

      await this.db.transaction(async (tx) => {
        await tx.delete(chunks).where(eq(chunks.documentId, documentId))
        for (let start = 0; start < pieces.length; start += INSERT_BATCH) {
          await tx.insert(chunks).values(
            pieces
              .slice(start, start + INSERT_BATCH)
              .map((content, offset) => ({
                documentId,
                knowledgeBaseId: kb.id,
                embeddingModelId: model.id,
                chunkIndex: start + offset,
                content,
                metadata: { title: document.title },
                dimensions: model.dimensions,
                embedding: vectors[start + offset]!,
              })),
          )
        }
        await tx
          .update(documents)
          .set({ status: 'ready', chunkCount: pieces.length, error: null })
          .where(eq(documents.id, documentId))
      })
      this.logger.log(
        `Indexed document ${documentId} (${pieces.length} chunks)`,
      )
    } catch (error) {
      const finalAttempt =
        error instanceof UnrecoverableError ||
        job.attemptsMade + 1 >= (job.opts.attempts ?? 1)
      await this.db
        .update(documents)
        .set({
          status: finalAttempt ? 'failed' : 'pending',
          error: (error as Error).message.slice(0, 1000),
        })
        .where(eq(documents.id, documentId))
      throw error
    }
  }
}
