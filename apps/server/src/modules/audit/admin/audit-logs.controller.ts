import { Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminController } from '../../auth/decorators.js'
import { RequirePermissions } from '../../rbac/policies.js'
import { AuditService } from '../audit.service.js'
import { ListAuditLogsQueryDto } from '../dto/audit-log.dto.js'

/** Audit trail of API requests from both realms (read-only; entries expire after `AUDIT_LOG_RETENTION_DAYS`). */
@ApiTags('admin / audit-logs')
@AdminController('audit-logs')
export class AuditLogsController {
  constructor(private readonly audit: AuditService) {}

  /** Newest first. `keyword` matches the actor email, action and path. */
  @Get()
  @RequirePermissions('audit-log:read')
  list(@Query() query: ListAuditLogsQueryDto) {
    return this.audit.list(query)
  }

  @Get(':id')
  @RequirePermissions('audit-log:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.audit.get(id)
  }
}
