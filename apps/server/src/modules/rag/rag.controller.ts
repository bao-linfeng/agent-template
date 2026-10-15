import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import { readSingleFile } from '../../common/http/multipart.js';
import type { AuthUser, HttpRequest } from '../../common/http/request.js';
import type { Env } from '../../config/env.js';
import { CurrentUser } from '../auth/decorators.js';
import type { AppAbility } from '../rbac/ability.js';
import { CurrentAbility, RequirePermissions } from '../rbac/policies.js';
import { SUPPORTED_EXTENSIONS } from './document-parsers.js';
import { DocumentsService } from './documents.service.js';
import {
  CreateKnowledgeBaseDto,
  CreateTextDocumentDto,
  SearchKnowledgeBaseDto,
  UpdateKnowledgeBaseDto,
} from './dto/rag.dto.js';
import { KnowledgeBasesService } from './knowledge-bases.service.js';
import { RetrievalService } from './retrieval.service.js';

/**
 * Knowledge bases are owned by their creator. Owners can read/update/delete their own; the
 * `knowledge-base:read` / `knowledge-base:manage` permissions extend that to every knowledge base.
 */
@ApiTags('rag')
@Controller('rag/knowledge-bases')
export class RagController {
  constructor(
    private readonly knowledgeBases: KnowledgeBasesService,
    private readonly documents: DocumentsService,
    private readonly retrieval: RetrievalService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @CurrentAbility() ability: AppAbility,
    @Query() query: PaginationQueryDto,
  ) {
    return this.knowledgeBases.list(user.id, ability, query);
  }

  @Post()
  @RequirePermissions('knowledge-base:create')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateKnowledgeBaseDto) {
    return this.knowledgeBases.create(user.id, dto);
  }

  @Get(':id')
  get(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.knowledgeBases.getAuthorized(id, ability);
  }

  @Patch(':id')
  async update(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeBases.update(
      await this.knowledgeBases.getAuthorized(id, ability, 'update'),
      dto,
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.knowledgeBases.remove(
      await this.knowledgeBases.getAuthorized(id, ability, 'delete'),
    );
  }

  /** Semantic search; returns the closest chunks with cosine similarity scores. */
  @Post(':id/search')
  @HttpCode(200)
  async search(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SearchKnowledgeBaseDto,
  ) {
    const kb = await this.knowledgeBases.getAuthorized(id, ability);
    return this.retrieval.retrieve(kb, dto.query, {
      topK: dto.topK,
      minScore: dto.minScore,
    });
  }

  @Get(':id/documents')
  async listDocuments(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.documents.list(
      await this.knowledgeBases.getAuthorized(id, ability),
      query,
    );
  }

  /** Upload a text file (multipart field `file`, optional field `title` sent before it). Indexing runs in the background. */
  @Post(':id/documents')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: `Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  async upload(
    @CurrentUser() user: AuthUser,
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: HttpRequest,
  ) {
    const kb = await this.knowledgeBases.getAuthorized(id, ability, 'update');
    const file = await readSingleFile(
      request,
      this.config.get('UPLOAD_MAX_BYTES', { infer: true }),
    );
    return this.documents.addFile(kb, user.id, file);
  }

  @Post(':id/documents/text')
  async addText(
    @CurrentUser() user: AuthUser,
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTextDocumentDto,
  ) {
    const kb = await this.knowledgeBases.getAuthorized(id, ability, 'update');
    return this.documents.addText(kb, user.id, dto.title, dto.content);
  }

  @Get(':id/documents/:documentId')
  async getDocument(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.get(
      await this.knowledgeBases.getAuthorized(id, ability),
      documentId,
    );
  }

  @Post(':id/documents/:documentId/reindex')
  @HttpCode(202)
  async reindex(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documents.reindex(
      await this.knowledgeBases.getAuthorized(id, ability, 'update'),
      documentId,
    );
  }

  @Delete(':id/documents/:documentId')
  @HttpCode(204)
  async removeDocument(
    @CurrentAbility() ability: AppAbility,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.documents.remove(
      await this.knowledgeBases.getAuthorized(id, ability, 'update'),
      documentId,
    );
  }
}
