import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { count, desc, eq, ilike, and, type SQL } from 'drizzle-orm';
import {
  likePattern,
  pageOffset,
  type PaginationQueryDto,
  type Paginated,
} from '../../common/dto/pagination.dto.js';
import type { Database } from '../../database/database.js';
import { InjectDb } from '../../database/database.module.js';
import {
  embeddingModels,
  knowledgeBases,
  type KnowledgeBaseRow,
} from '../../database/schema/index.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { EmbeddingModelsService } from '../ai/embedding-models.service.js';
import type {
  CreateKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from './dto/rag.dto.js';

export interface KnowledgeBaseView extends KnowledgeBaseRow {
  embeddingModel: {
    id: string;
    name: string;
    model: string;
    dimensions: number;
  };
}

@Injectable()
export class KnowledgeBasesService {
  private readonly logger = new Logger(KnowledgeBasesService.name);

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly models: EmbeddingModelsService,
    private readonly storage: StorageService,
  ) {}

  /** `keyword` matches the name; `ownerId` limits the list to one client user's knowledge bases. */
  async list(
    query: PaginationQueryDto,
    ownerId?: string,
  ): Promise<Paginated<KnowledgeBaseView>> {
    const filters: SQL[] = [];
    if (ownerId) {
      filters.push(eq(knowledgeBases.ownerId, ownerId));
    }
    if (query.keyword) {
      filters.push(ilike(knowledgeBases.name, likePattern(query.keyword)));
    }
    const where = filters.length > 0 ? and(...filters) : undefined;
    const [rows, [totals]] = await Promise.all([
      this.selectViews()
        .where(where)
        .orderBy(desc(knowledgeBases.createdAt))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(knowledgeBases).where(where),
    ]);
    return {
      items: rows,
      total: totals?.total ?? 0,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /** Any knowledge base (admin routes, after their permission check). */
  async get(id: string): Promise<KnowledgeBaseView> {
    const [kb] = await this.selectViews()
      .where(eq(knowledgeBases.id, id))
      .limit(1);
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }
    return kb;
  }

  /** A knowledge base of the given client user; other users' knowledge bases look like missing ones. */
  async getOwned(id: string, ownerId: string): Promise<KnowledgeBaseView> {
    const [kb] = await this.selectViews()
      .where(
        and(eq(knowledgeBases.id, id), eq(knowledgeBases.ownerId, ownerId)),
      )
      .limit(1);
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }
    return kb;
  }

  async create(
    ownerId: string,
    dto: CreateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseView> {
    const model = dto.embeddingModelId
      ? await this.models.get(dto.embeddingModelId)
      : await this.models.getDefault();
    if (!model) {
      throw new BadRequestException(
        'No default embedding model is configured; ask an administrator to add one',
      );
    }
    if (!model.enabled) {
      throw new BadRequestException('The selected embedding model is disabled');
    }
    const chunkSize = dto.chunkSize ?? 800;
    const chunkOverlap =
      dto.chunkOverlap ?? Math.min(100, Math.floor(chunkSize / 4));
    assertChunking(chunkSize, chunkOverlap);
    const [kb] = await this.db
      .insert(knowledgeBases)
      .values({
        name: dto.name,
        description: dto.description,
        ownerId,
        embeddingModelId: model.id,
        chunkSize,
        chunkOverlap,
      })
      .returning({ id: knowledgeBases.id });
    const [view] = await this.selectViews().where(
      eq(knowledgeBases.id, kb!.id),
    );
    return view!;
  }

  async update(
    kb: KnowledgeBaseView,
    dto: UpdateKnowledgeBaseDto,
  ): Promise<KnowledgeBaseView> {
    assertChunking(
      dto.chunkSize ?? kb.chunkSize,
      dto.chunkOverlap ?? kb.chunkOverlap,
    );
    await this.db
      .update(knowledgeBases)
      .set(dto)
      .where(eq(knowledgeBases.id, kb.id));
    const [view] = await this.selectViews().where(eq(knowledgeBases.id, kb.id));
    return view!;
  }

  async remove(kb: KnowledgeBaseView): Promise<void> {
    await this.db.delete(knowledgeBases).where(eq(knowledgeBases.id, kb.id));
    try {
      await this.storage.deletePrefix(`rag/${kb.id}/`);
    } catch (error) {
      this.logger.warn(
        `Failed to delete files of knowledge base ${kb.id}: ${(error as Error).message}`,
      );
    }
  }

  private selectViews() {
    return this.db
      .select({
        id: knowledgeBases.id,
        name: knowledgeBases.name,
        description: knowledgeBases.description,
        ownerId: knowledgeBases.ownerId,
        embeddingModelId: knowledgeBases.embeddingModelId,
        chunkSize: knowledgeBases.chunkSize,
        chunkOverlap: knowledgeBases.chunkOverlap,
        createdAt: knowledgeBases.createdAt,
        updatedAt: knowledgeBases.updatedAt,
        embeddingModel: {
          id: embeddingModels.id,
          name: embeddingModels.name,
          model: embeddingModels.model,
          dimensions: embeddingModels.dimensions,
        },
      })
      .from(knowledgeBases)
      .innerJoin(
        embeddingModels,
        eq(knowledgeBases.embeddingModelId, embeddingModels.id),
      )
      .$dynamic();
  }
}

function assertChunking(chunkSize: number, chunkOverlap: number): void {
  if (chunkOverlap * 2 > chunkSize) {
    throw new BadRequestException(
      'chunkOverlap must be at most half of chunkSize',
    );
  }
}
