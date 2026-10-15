import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { embeddingModels } from './ai.js';
import { timestamps, vector } from './columns.js';
import { users } from './users.js';

export const knowledgeBases = pgTable(
  'rag_knowledge_bases',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: varchar({ length: 100 }).notNull(),
    description: text(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Fixed per knowledge base: vectors from different models are not comparable. */
    embeddingModelId: uuid()
      .notNull()
      .references(() => embeddingModels.id, { onDelete: 'restrict' }),
    chunkSize: integer().notNull().default(800),
    chunkOverlap: integer().notNull().default(100),
    ...timestamps,
  },
  (table) => [index().on(table.ownerId)],
);

export const documentStatus = pgEnum('rag_document_status', [
  'pending',
  'processing',
  'ready',
  'failed',
]);
export const documentSource = pgEnum('rag_document_source', ['file', 'text']);

export const documents = pgTable(
  'rag_documents',
  {
    id: uuid().primaryKey().defaultRandom(),
    knowledgeBaseId: uuid()
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    title: varchar({ length: 255 }).notNull(),
    source: documentSource().notNull(),
    /** Original content in object storage. */
    storageKey: text().notNull(),
    mimeType: varchar({ length: 100 }).notNull(),
    sizeBytes: integer().notNull(),
    status: documentStatus().notNull().default('pending'),
    error: text(),
    chunkCount: integer().notNull().default(0),
    createdById: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (table) => [index().on(table.knowledgeBaseId)],
);

export const chunks = pgTable(
  'rag_chunks',
  {
    id: uuid().primaryKey().defaultRandom(),
    documentId: uuid()
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    knowledgeBaseId: uuid()
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    embeddingModelId: uuid()
      .notNull()
      .references(() => embeddingModels.id, { onDelete: 'restrict' }),
    chunkIndex: integer().notNull(),
    content: text().notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    dimensions: integer().notNull(),
    embedding: vector().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index().on(table.knowledgeBaseId), index().on(table.documentId)],
);

export type KnowledgeBaseRow = typeof knowledgeBases.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type DocumentStatus = (typeof documentStatus.enumValues)[number];
