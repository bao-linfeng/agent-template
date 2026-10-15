import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { AdminController } from '../auth/decorators.js';
import { RequirePermissions } from '../rbac/policies.js';
import { DocumentsService } from './documents.service.js';
import {
  AdminListKnowledgeBasesQueryDto,
  SearchKnowledgeBaseDto,
} from './dto/rag.dto.js';
import { KnowledgeBasesService } from './knowledge-bases.service.js';
import { RetrievalService } from './retrieval.service.js';

/** Every client user's knowledge bases, for administrators (`knowledge-base:read` / `knowledge-base:manage`). */
@ApiTags('admin / rag')
@AdminController('rag/knowledge-bases')
export class AdminRagController {
  constructor(
    private readonly knowledgeBases: KnowledgeBasesService,
    private readonly documents: DocumentsService,
    private readonly retrieval: RetrievalService,
  ) {}

  /** `keyword` matches the name. */
  @Get()
  @RequirePermissions('knowledge-base:read')
  list(@Query() query: AdminListKnowledgeBasesQueryDto) {
    return this.knowledgeBases.list(query, query.ownerId);
  }

  @Get(':id')
  @RequirePermissions('knowledge-base:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeBases.get(id);
  }

  @Post(':id/search')
  @HttpCode(200)
  @RequirePermissions('knowledge-base:read')
  async search(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SearchKnowledgeBaseDto,
  ) {
    return this.retrieval.retrieve(
      await this.knowledgeBases.get(id),
      dto.query,
      {
        topK: dto.topK,
        minScore: dto.minScore,
      },
    );
  }

  @Get(':id/documents')
  @RequirePermissions('knowledge-base:read')
  async listDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.documents.list(await this.knowledgeBases.get(id), query);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('knowledge-base:manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.knowledgeBases.remove(await this.knowledgeBases.get(id));
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(204)
  @RequirePermissions('knowledge-base:manage')
  async removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.documents.remove(await this.knowledgeBases.get(id), documentId);
  }
}
