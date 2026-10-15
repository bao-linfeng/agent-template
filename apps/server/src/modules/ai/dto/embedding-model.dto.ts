import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator'
import { embeddingProvider } from '../../../database/schema/index.js'

/** pgvector HNSW indexes support up to 2000 dimensions for `vector`. */
export const MAX_EMBEDDING_DIMENSIONS = 2000

export class CreateEmbeddingModelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string

  @IsOptional()
  @IsIn(embeddingProvider.enumValues)
  provider?: (typeof embeddingProvider.enumValues)[number]

  /** API root that serves `/embeddings`, e.g. `http://localhost:11434/v1` for Ollama. */
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  baseUrl!: string

  /** Provider model id, e.g. `bge-m3`, `BAAI/bge-m3`, `text-embedding-3-small`. */
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string

  @IsInt()
  @Min(1)
  @Max(MAX_EMBEDDING_DIMENSIONS)
  dimensions!: number

  /** Stored encrypted; omit for providers without auth. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(512)
  batchSize?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  /** Becomes the model used by new knowledge bases. */
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean
}

export class UpdateEmbeddingModelDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string

  @IsOptional()
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  baseUrl?: string

  /** `model` and `dimensions` are locked once a knowledge base uses this model. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_EMBEDDING_DIMENSIONS)
  dimensions?: number

  /** `undefined` keeps the stored key, `null` or `""` clears it. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @MaxLength(500)
  apiKey?: string | null

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(512)
  batchSize?: number

  @IsOptional()
  @IsBoolean()
  enabled?: boolean
}

/** Ad-hoc connectivity test before saving a configuration. */
export class TestEmbeddingConfigDto {
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  baseUrl!: string

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  model!: string

  @IsInt()
  @Min(1)
  @Max(MAX_EMBEDDING_DIMENSIONS)
  dimensions!: number

  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string
}
