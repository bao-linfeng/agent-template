import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Defaults to the admin-configured default model. Cannot change after creation. */
  @IsOptional()
  @IsUUID()
  embeddingModelId?: string;

  /** Max characters per chunk. */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;
}

/** Chunk settings apply to documents ingested afterwards; reindex to apply them to existing ones. */
export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(8000)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2000)
  chunkOverlap?: number;
}

export class CreateTextDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  /** Markdown or plain text. */
  @IsString()
  @MinLength(1)
  @MaxLength(1_000_000)
  content!: string;
}

export class SearchKnowledgeBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topK: number = 5;

  /** Cosine similarity threshold in [0, 1]. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;
}

export class AdminListKnowledgeBasesQueryDto extends PaginationQueryDto {
  /** Only knowledge bases of this client user. */
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
