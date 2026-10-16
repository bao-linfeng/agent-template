import { Type } from 'class-transformer'
import {
  IsDate,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js'
import { REALMS, type Realm } from '../../auth/realms.js'

export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(REALMS)
  realm?: Realm

  /** `users.id` or `admin_users.id` (combine with `realm`). */
  @IsOptional()
  @IsUUID()
  actorId?: string

  /** Exact action, e.g. `RolesController.update`. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  action?: string

  @IsOptional()
  @IsIn(['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string

  /** Id of the affected record (route `:id` or created record). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string

  /** `success`: status < 400, `failure`: status >= 400. */
  @IsOptional()
  @IsIn(['success', 'failure'])
  outcome?: 'success' | 'failure'

  /** Inclusive lower bound of `createdAt` (ISO 8601). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date

  /** Exclusive upper bound of `createdAt` (ISO 8601). */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date
}
