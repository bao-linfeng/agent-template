import { sql } from 'drizzle-orm'
import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { timestamps } from './columns.js'

export const embeddingProvider = pgEnum('embedding_provider', [
  'openai_compatible',
])

/**
 * Embedding models managed from the admin console. `openai_compatible` covers any server exposing
 * `POST {baseUrl}/embeddings` (OpenAI, Ollama, vLLM, Xinference, TEI, SiliconFlow, ...).
 */
export const embeddingModels = pgTable(
  'ai_embedding_models',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 100 }).notNull().unique(),
    provider: embeddingProvider().notNull().default('openai_compatible'),
    baseUrl: text().notNull(),
    model: varchar({ length: 200 }).notNull(),
    dimensions: integer().notNull(),
    /** AES-256-GCM ciphertext produced by `CryptoService`; never returned by the API. */
    apiKeyEncrypted: text(),
    /** Max inputs per embeddings request. */
    batchSize: integer().notNull().default(32),
    enabled: boolean().notNull().default(true),
    isDefault: boolean().notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('ai_embedding_models_single_default')
      .on(table.isDefault)
      .where(sql`${table.isDefault}`),
  ],
)

export type EmbeddingModelRow = typeof embeddingModels.$inferSelect
