import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AuditService } from './audit.service.js'

const PRUNE_SCHEDULER = 'audit-log-prune'
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Deletes audit entries older than `AUDIT_LOG_RETENTION_DAYS` every night at 03:00 (server time). The
 * BullMQ job scheduler runs it once per cluster; retention 0 removes the schedule.
 */
@Processor(QUEUES.audit)
export class AuditPruneProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(AuditPruneProcessor.name)

  constructor(
    private readonly audit: AuditService,
    @InjectQueue(QUEUES.audit) private readonly queue: Queue,
  ) {
    super()
  }

  async onApplicationBootstrap(): Promise<void> {
    if (this.audit.retentionDays > 0) {
      await this.queue.upsertJobScheduler(
        PRUNE_SCHEDULER,
        { pattern: '0 3 * * *' },
        { name: 'prune' },
      )
    } else {
      await this.queue.removeJobScheduler(PRUNE_SCHEDULER)
    }
  }

  async process(): Promise<void> {
    const days = this.audit.retentionDays
    if (days <= 0) {
      return
    }
    const deleted = await this.audit.prune(new Date(Date.now() - days * DAY_MS))
    if (deleted > 0) {
      this.logger.log(
        `Deleted ${deleted} audit log entries older than ${days} days`,
      )
    }
  }
}
