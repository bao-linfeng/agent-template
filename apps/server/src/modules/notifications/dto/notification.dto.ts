import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js'
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from '../notifications.catalog.js'

/** `true`/`false` query strings to booleans; other values fail `@IsBoolean`. */
const booleanQuery = () =>
  Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )

export class ListNotificationsQueryDto extends PaginationQueryDto {
  /** Only unread notifications. */
  @IsOptional()
  @booleanQuery()
  @IsBoolean()
  unread?: boolean

  @IsOptional()
  @IsIn(Object.keys(NOTIFICATION_CATEGORIES))
  category?: NotificationCategory
}

export class UpdateNotificationPreferencesDto {
  /**
   * `{ <category>: { <channel>: boolean } }` (see `GET .../notifications/preferences` for the categories
   * and channels of the realm); omitted ones stay unchanged. Applied atomically.
   */
  @IsObject()
  preferences!: Record<string, unknown>
}
