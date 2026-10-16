import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AuditLogsController } from './admin/audit-logs.controller.js'
import { AuditPruneProcessor } from './audit-prune.processor.js'
import { AuditService } from './audit.service.js'

/**
 * Unified audit trail of API requests. Collection is wired globally: `AuditGuard`/`AuditInterceptor`
 * in `app.module.ts`, the `onResponse` hook in `setup-app.ts` (`registerAuditHook`) and the error code
 * in `AllExceptionsFilter`. Routes tune it with `@Audit()`.
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.audit })],
  controllers: [AuditLogsController],
  providers: [AuditService, AuditPruneProcessor],
  exports: [AuditService],
})
export class AuditModule {}
