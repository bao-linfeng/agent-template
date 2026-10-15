import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, count, eq } from 'drizzle-orm';
import type { Pool } from 'pg';
import { SecretBox } from '../../common/crypto/crypto.js';
import type { Database } from '../../database/database.js';
import { InjectDb, PG_POOL } from '../../database/database.module.js';
import {
  isForeignKeyViolation,
  isUniqueViolation,
} from '../../database/errors.js';
import {
  embeddingModels,
  knowledgeBases,
  type EmbeddingModelRow,
} from '../../database/schema/index.js';
import { EmbeddingClient, type EmbeddingTarget } from './embedding-client.js';
import {
  MAX_EMBEDDING_DIMENSIONS,
  type CreateEmbeddingModelDto,
  type TestEmbeddingConfigDto,
  type UpdateEmbeddingModelDto,
} from './dto/embedding-model.dto.js';

export type EmbeddingModelView = Omit<EmbeddingModelRow, 'apiKeyEncrypted'> & {
  hasApiKey: boolean;
};

export interface EmbeddingTestResult {
  ok: boolean;
  dimensions?: number;
  latencyMs: number;
  error?: string;
}

/**
 * Embedding model registry managed from the admin console. Vectors of all models share
 * `rag_chunks`; each distinct dimension gets its own partial HNSW index.
 */
@Injectable()
export class EmbeddingModelsService {
  constructor(
    @InjectDb() private readonly db: Database,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly secrets: SecretBox,
    private readonly client: EmbeddingClient,
  ) {}

  async list(): Promise<EmbeddingModelView[]> {
    const rows = await this.db
      .select()
      .from(embeddingModels)
      .orderBy(asc(embeddingModels.createdAt));
    return rows.map((row) => this.toView(row));
  }

  async get(id: string): Promise<EmbeddingModelRow> {
    const row = await this.db.query.embeddingModels.findFirst({
      where: eq(embeddingModels.id, id),
    });
    if (!row) {
      throw new NotFoundException('Embedding model not found');
    }
    return row;
  }

  async getView(id: string): Promise<EmbeddingModelView> {
    return this.toView(await this.get(id));
  }

  /** The enabled default model, used when a knowledge base is created without an explicit model. */
  async getDefault(): Promise<EmbeddingModelRow | undefined> {
    return this.db.query.embeddingModels.findFirst({
      where: eq(embeddingModels.isDefault, true),
    });
  }

  async create(dto: CreateEmbeddingModelDto): Promise<EmbeddingModelView> {
    await this.ensureVectorIndex(dto.dimensions);
    try {
      const row = await this.db.transaction(async (tx) => {
        if (dto.isDefault) {
          await tx
            .update(embeddingModels)
            .set({ isDefault: false })
            .where(eq(embeddingModels.isDefault, true));
        }
        const [created] = await tx
          .insert(embeddingModels)
          .values({
            name: dto.name,
            provider: dto.provider,
            baseUrl: dto.baseUrl,
            model: dto.model,
            dimensions: dto.dimensions,
            apiKeyEncrypted: dto.apiKey
              ? this.secrets.encrypt(dto.apiKey)
              : null,
            batchSize: dto.batchSize,
            enabled: dto.enabled,
            isDefault: dto.isDefault ?? false,
          })
          .returning();
        return created!;
      });
      return this.toView(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An embedding model with this name already exists',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    dto: UpdateEmbeddingModelDto,
  ): Promise<EmbeddingModelView> {
    const current = await this.get(id);
    const changesVectors =
      (dto.model !== undefined && dto.model !== current.model) ||
      (dto.dimensions !== undefined && dto.dimensions !== current.dimensions);
    if (changesVectors && (await this.usageCount(id)) > 0) {
      throw new ConflictException(
        'model and dimensions cannot change while knowledge bases use this model; create a new model instead',
      );
    }
    if (dto.enabled === false && current.isDefault) {
      throw new BadRequestException(
        'Set another default model before disabling this one',
      );
    }
    if (dto.dimensions !== undefined) {
      await this.ensureVectorIndex(dto.dimensions);
    }
    const { apiKey, ...rest } = dto;
    try {
      const [row] = await this.db
        .update(embeddingModels)
        .set({
          ...rest,
          ...(apiKey === undefined
            ? {}
            : {
                apiKeyEncrypted: apiKey ? this.secrets.encrypt(apiKey) : null,
              }),
        })
        .where(eq(embeddingModels.id, id))
        .returning();
      return this.toView(row!);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An embedding model with this name already exists',
        );
      }
      throw error;
    }
  }

  async setDefault(id: string): Promise<EmbeddingModelView> {
    const model = await this.get(id);
    if (!model.enabled) {
      throw new BadRequestException('A disabled model cannot be the default');
    }
    await this.db.transaction(async (tx) => {
      await tx
        .update(embeddingModels)
        .set({ isDefault: false })
        .where(eq(embeddingModels.isDefault, true));
      await tx
        .update(embeddingModels)
        .set({ isDefault: true })
        .where(eq(embeddingModels.id, id));
    });
    return this.getView(id);
  }

  async remove(id: string): Promise<void> {
    const model = await this.get(id);
    if (model.isDefault) {
      throw new BadRequestException(
        'Set another default model before deleting this one',
      );
    }
    try {
      await this.db.delete(embeddingModels).where(eq(embeddingModels.id, id));
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new ConflictException(
          'This model is used by knowledge bases and cannot be deleted',
        );
      }
      throw error;
    }
  }

  /** Embeds a probe string with a saved model and checks the returned dimension. */
  async test(id: string): Promise<EmbeddingTestResult> {
    return this.probe(this.toTarget(await this.get(id)));
  }

  testConfig(dto: TestEmbeddingConfigDto): Promise<EmbeddingTestResult> {
    return this.probe({
      baseUrl: dto.baseUrl,
      model: dto.model,
      dimensions: dto.dimensions,
      apiKey: dto.apiKey,
      batchSize: 1,
    });
  }

  /** Decrypted connection settings for calling the provider. */
  toTarget(model: EmbeddingModelRow): EmbeddingTarget {
    return {
      baseUrl: model.baseUrl,
      model: model.model,
      dimensions: model.dimensions,
      apiKey: model.apiKeyEncrypted
        ? this.secrets.decrypt(model.apiKeyEncrypted)
        : null,
      batchSize: model.batchSize,
    };
  }

  /**
   * Creates the partial HNSW index for a dimension if missing. Built CONCURRENTLY so writes to
   * `rag_chunks` continue meanwhile; the migration pre-creates the 1024 (bge-m3) index.
   */
  async ensureVectorIndex(dimensions: number): Promise<void> {
    if (
      !Number.isInteger(dimensions) ||
      dimensions < 1 ||
      dimensions > MAX_EMBEDDING_DIMENSIONS
    ) {
      throw new BadRequestException(
        `dimensions must be an integer between 1 and ${MAX_EMBEDDING_DIMENSIONS}`,
      );
    }
    await this.pool.query(
      `CREATE INDEX CONCURRENTLY IF NOT EXISTS rag_chunks_embedding_${dimensions}_hnsw ON rag_chunks ` +
        `USING hnsw ((embedding::vector(${dimensions})) vector_cosine_ops) WHERE dimensions = ${dimensions}`,
    );
  }

  private async probe(target: EmbeddingTarget): Promise<EmbeddingTestResult> {
    const started = Date.now();
    try {
      const [vector] = await this.client.embed(target, ['connectivity test']);
      return {
        ok: true,
        dimensions: vector!.length,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: (error as Error).message,
      };
    }
  }

  private async usageCount(id: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.embeddingModelId, id));
    return row?.total ?? 0;
  }

  private toView({
    apiKeyEncrypted,
    ...row
  }: EmbeddingModelRow): EmbeddingModelView {
    return { ...row, hasApiKey: Boolean(apiKeyEncrypted) };
  }
}
