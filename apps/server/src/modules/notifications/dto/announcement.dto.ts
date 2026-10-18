import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js'
import {
  announcementAudience,
  announcementLevel,
  type AnnouncementAudience,
  type AnnouncementLevel,
} from '../../../database/schema/index.js'

export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'expired'] as const
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number]

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string

  /** Plain text (line breaks are kept, HTML is shown as text). */
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string

  /** Default `info`. */
  @IsOptional()
  @IsIn(announcementLevel.enumValues)
  level?: AnnouncementLevel

  /** `user` (client app), `admin` (admin console) or `all` (default). */
  @IsOptional()
  @IsIn(announcementAudience.enumValues)
  audience?: AnnouncementAudience

  /** Hidden from then on (ISO 8601, must be in the future); omit to keep it until withdrawn. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date

  /** Publish right away instead of saving a draft. */
  @IsOptional()
  @IsBoolean()
  publish?: boolean
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string

  @IsOptional()
  @IsIn(announcementLevel.enumValues)
  level?: AnnouncementLevel

  @IsOptional()
  @IsIn(announcementAudience.enumValues)
  audience?: AnnouncementAudience

  /** `null` removes the expiry. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date | null
}

export class ListAnnouncementsQueryDto extends PaginationQueryDto {
  /** `draft`: not published; `published`: visible now; `expired`: past `expiresAt`. */
  @IsOptional()
  @IsIn(ANNOUNCEMENT_STATUSES)
  status?: AnnouncementStatus

  @IsOptional()
  @IsIn(announcementAudience.enumValues)
  audience?: AnnouncementAudience
}
