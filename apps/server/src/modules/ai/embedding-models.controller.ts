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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/policies.js';
import {
  CreateEmbeddingModelDto,
  TestEmbeddingConfigDto,
  UpdateEmbeddingModelDto,
} from './dto/embedding-model.dto.js';
import { EmbeddingModelsService } from './embedding-models.service.js';

/** Admin console configuration of embedding providers. API keys are write-only (`hasApiKey` in responses). */
@ApiTags('admin / ai')
@Controller('admin/ai/embedding-models')
export class EmbeddingModelsController {
  constructor(private readonly models: EmbeddingModelsService) {}

  @Get()
  @RequirePermissions('embedding-model:read')
  list() {
    return this.models.list();
  }

  /** Tests an unsaved configuration (for the "test connection" button of the create form). */
  @Post('test')
  @HttpCode(200)
  @RequirePermissions('embedding-model:manage')
  testConfig(@Body() dto: TestEmbeddingConfigDto) {
    return this.models.testConfig(dto);
  }

  @Get(':id')
  @RequirePermissions('embedding-model:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.models.getView(id);
  }

  @Post()
  @RequirePermissions('embedding-model:manage')
  create(@Body() dto: CreateEmbeddingModelDto) {
    return this.models.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('embedding-model:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmbeddingModelDto,
  ) {
    return this.models.update(id, dto);
  }

  @Post(':id/default')
  @HttpCode(200)
  @RequirePermissions('embedding-model:manage')
  setDefault(@Param('id', ParseUUIDPipe) id: string) {
    return this.models.setDefault(id);
  }

  @Post(':id/test')
  @HttpCode(200)
  @RequirePermissions('embedding-model:manage')
  test(@Param('id', ParseUUIDPipe) id: string) {
    return this.models.test(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('embedding-model:manage')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.models.remove(id);
  }
}
