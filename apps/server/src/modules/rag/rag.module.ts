import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AiModule } from '../ai/ai.module.js'
import { AdminRagController } from './admin-rag.controller.js'
import { DocumentsService } from './documents.service.js'
import { IngestProcessor } from './ingest.processor.js'
import { KnowledgeBasesService } from './knowledge-bases.service.js'
import { RagController } from './rag.controller.js'
import { RetrievalService } from './retrieval.service.js'

@Module({
  imports: [AiModule, BullModule.registerQueue({ name: QUEUES.ragIngest })],
  controllers: [RagController, AdminRagController],
  providers: [
    KnowledgeBasesService,
    DocumentsService,
    RetrievalService,
    IngestProcessor,
  ],
  exports: [KnowledgeBasesService, RetrievalService],
})
export class RagModule {}
