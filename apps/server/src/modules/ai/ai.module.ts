import { Module } from '@nestjs/common'
import { EmbeddingClient } from './embedding-client.js'
import { EmbeddingModelsController } from './admin/embedding-models.controller.js'
import { EmbeddingModelsService } from './embedding-models.service.js'

@Module({
  controllers: [EmbeddingModelsController],
  providers: [EmbeddingClient, EmbeddingModelsService],
  exports: [EmbeddingClient, EmbeddingModelsService],
})
export class AiModule {}
