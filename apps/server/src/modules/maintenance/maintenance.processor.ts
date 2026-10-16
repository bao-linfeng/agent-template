import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger, OnApplicationBootstrap } from '@nestjs/common'
import { UnrecoverableError, type Job, type Queue } from 'bullmq'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { SettingsService } from '../settings/settings.service.js'
import { AccountExportsCleanup } from './account-exports.cleanup.js'
import { AuthRecordsCleanup } from './auth-records.cleanup.js'
import { DeletedAccountsCleanup } from './deleted-accounts.cleanup.js'
import { OrphanObjectsCleanup } from './orphan-objects.cleanup.js'

/** Job scheduler ids; each scheduler emits jobs with the same name. */
export const MAINTENANCE_JOBS = {
  accountExportsPrune: 'account-exports-prune',
  authRecordsPrune: 'auth-records-prune',
  accountPurge: 'account-purge',
  storageOrphanSweep: 'storage-orphan-sweep',
} as const

const DAY_MS = 24 * 60 * 60 * 1000
/** Objects younger than this may belong to an upload whose row is still being written. */
export const ORPHAN_GRACE_MS = DAY_MS

/**
 * Nightly housekeeping (server time) on the `maintenance` queue. BullMQ job schedulers run each job once
 * per cluster. Every task stays scheduled; the ones behind a runtime setting (`modules/settings`) check it
 * when they run and finish without work while it is off, so switching them needs no restart and keeps
 * `ScheduledJobMissed` quiet.
 * - 03:15 `account-exports-prune`: data exports past `expiresAt` (`ACCOUNT_EXPORT_TTL_HOURS`), stuck ones.
 * - 03:30 `auth-records-prune`: sessions and reset tokens `maintenance.authRecordRetentionDays` after they
 *   ended (0 = keep).
 * - 03:45 `account-purge`: client accounts whose deletion grace period (`account.deletionGraceDays`) ended.
 * - 04:00 `storage-orphan-sweep`: unreferenced avatar/RAG/export objects (`maintenance.storageOrphanSweepEnabled`).
 */
@Processor(QUEUES.maintenance)
export class MaintenanceProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(MaintenanceProcessor.name)

  constructor(
    private readonly authRecords: AuthRecordsCleanup,
    private readonly orphanObjects: OrphanObjectsCleanup,
    private readonly deletedAccounts: DeletedAccountsCleanup,
    private readonly accountExports: AccountExportsCleanup,
    @InjectQueue(QUEUES.maintenance) private readonly queue: Queue,
    private readonly settings: SettingsService,
  ) {
    super()
  }

  async onApplicationBootstrap(): Promise<void> {
    for (const [id, pattern] of [
      [MAINTENANCE_JOBS.accountExportsPrune, '15 3 * * *'],
      [MAINTENANCE_JOBS.authRecordsPrune, '30 3 * * *'],
      [MAINTENANCE_JOBS.accountPurge, '45 3 * * *'],
      [MAINTENANCE_JOBS.storageOrphanSweep, '0 4 * * *'],
    ] as const) {
      await this.queue.upsertJobScheduler(id, { pattern }, { name: id })
    }
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case MAINTENANCE_JOBS.authRecordsPrune:
        return this.pruneAuthRecords()
      case MAINTENANCE_JOBS.storageOrphanSweep:
        return this.sweepOrphanObjects()
      case MAINTENANCE_JOBS.accountPurge:
        return this.purgeDeletedAccounts()
      case MAINTENANCE_JOBS.accountExportsPrune:
        return this.pruneAccountExports()
      default:
        throw new UnrecoverableError(`Unknown maintenance job "${job.name}"`)
    }
  }

  private async pruneAuthRecords(): Promise<void> {
    const days = this.settings.get('maintenance.authRecordRetentionDays')
    if (days <= 0) {
      return
    }
    const deleted = await this.authRecords.run(
      new Date(Date.now() - days * DAY_MS),
    )
    if (deleted.sessions > 0 || deleted.resetTokens > 0) {
      this.logger.log(
        `Deleted ${deleted.sessions} sessions and ${deleted.resetTokens} reset tokens that ended over ${days} days ago`,
      )
    }
  }

  private async sweepOrphanObjects(): Promise<void> {
    if (!this.settings.get('maintenance.storageOrphanSweepEnabled')) {
      return
    }
    const deleted = await this.orphanObjects.run(
      new Date(Date.now() - ORPHAN_GRACE_MS),
    )
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} unreferenced storage objects`)
    }
  }

  private async purgeDeletedAccounts(): Promise<void> {
    // Logs on its own: it emails every purged user.
    await this.deletedAccounts.run(new Date())
  }

  private async pruneAccountExports(): Promise<void> {
    const deleted = await this.accountExports.run(new Date())
    if (deleted > 0) {
      this.logger.log(`Deleted ${deleted} expired data exports`)
    }
  }
}
