import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class PaginationQueryDto {
  /** 1-based page number. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  /** Free-text filter; each list endpoint documents which fields it matches. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function pageOffset(query: PaginationQueryDto): number {
  return (query.page - 1) * query.pageSize;
}

/** Escapes `%`, `_` and `\` so user input is matched literally inside ILIKE patterns. */
export function likePattern(keyword: string): string {
  return `%${keyword.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
