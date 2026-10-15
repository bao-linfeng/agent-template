import { BadRequestException, Injectable } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { toVectorLiteral } from '../../database/schema/columns.js'
import { EmbeddingClient } from '../ai/embedding-client.js'
import { EmbeddingModelsService } from '../ai/embedding-models.service.js'

export interface RetrievedChunk {
  id: string
  documentId: string
  documentTitle: string
  chunkIndex: number
  content: string
  metadata: Record<string, unknown>
  /** Cosine similarity in [-1, 1]; higher is closer. */
  score: number
}

export interface RetrieveOptions {
  topK?: number
  minScore?: number
}

/**
 * Vector retrieval over one knowledge base. Use this from agents/tools directly; the HTTP search
 * endpoint is a thin wrapper. Authorization is the caller's responsibility.
 */
@Injectable()
export class RetrievalService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly models: EmbeddingModelsService,
    private readonly embeddings: EmbeddingClient,
  ) {}

  async retrieve(
    kb: { id: string; embeddingModelId: string },
    query: string,
    options: RetrieveOptions = {},
  ): Promise<RetrievedChunk[]> {
    const topK = options.topK ?? 5
    const model = await this.models.get(kb.embeddingModelId)
    if (!model.enabled) {
      throw new BadRequestException(
        `Embedding model "${model.name}" is disabled`,
      )
    }
    const [vector] = await this.embeddings.embed(this.models.toTarget(model), [
      query,
    ])

    // The dimension is a validated integer from the database; it is inlined so the planner can match the
    // partial expression index `(embedding::vector(N)) ... WHERE dimensions = N`.
    const dims = sql.raw(String(Math.trunc(model.dimensions)))
    const queryVector = sql`${toVectorLiteral(vector!)}::vector(${dims})`
    const distance = sql`(c.embedding::vector(${dims}) <=> ${queryVector})`

    return this.db.transaction(async (tx) => {
      // pgvector >= 0.8: keep scanning the HNSW index until enough rows pass the knowledge-base filter.
      await tx.execute(sql`SET LOCAL hnsw.iterative_scan = relaxed_order`)
      await tx.execute(
        sql.raw(`SET LOCAL hnsw.ef_search = ${Math.max(100, topK * 2)}`),
      )
      const result = await tx.execute<{
        id: string
        document_id: string
        document_title: string
        chunk_index: number
        content: string
        metadata: Record<string, unknown>
        distance: number
      }>(sql`
        WITH nearest AS MATERIALIZED (
          SELECT c.id, c.document_id, c.chunk_index, c.content, c.metadata, ${distance} AS distance
          FROM rag_chunks c
          WHERE c.dimensions = ${dims}
            AND c.knowledge_base_id = ${kb.id}
            AND c.embedding_model_id = ${model.id}
          ORDER BY ${distance}
          LIMIT ${topK}
        )
        SELECT n.*, d.title AS document_title
        FROM nearest n
        JOIN rag_documents d ON d.id = n.document_id
        ORDER BY n.distance`)

      return result.rows
        .map((row) => ({
          id: row.id,
          documentId: row.document_id,
          documentTitle: row.document_title,
          chunkIndex: row.chunk_index,
          content: row.content,
          metadata: row.metadata,
          score: 1 - Number(row.distance),
        }))
        .filter(
          (chunk) =>
            options.minScore === undefined || chunk.score >= options.minScore,
        )
    })
  }
}
