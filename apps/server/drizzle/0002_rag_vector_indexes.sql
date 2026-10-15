-- `rag_chunks.embedding` is an untyped `vector` so models with different dimensions can share the table.
-- Keep the declared dimension honest, and index each dimension with a partial expression HNSW index.
-- Indexes for other dimensions are created at runtime by EmbeddingModelsService.ensureVectorIndex().
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_embedding_dimensions_check" CHECK (vector_dims("embedding") = "dimensions");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_1024_hnsw" ON "rag_chunks" USING hnsw (("embedding"::vector(1024)) vector_cosine_ops) WHERE "dimensions" = 1024;
