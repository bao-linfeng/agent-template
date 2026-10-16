import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AccountExportsCleanup } from './account-exports.cleanup.js'
import { AuthRecordsCleanup } from './auth-records.cleanup.js'
import { DeletedAccountsCleanup } from './deleted-accounts.cleanup.js'
import { MaintenanceProcessor } from './maintenance.processor.js'
import { OrphanObjectsCleanup } from './orphan-objects.cleanup.js'

/**
 * Scheduled housekeeping that spans modules (auth records, deleted accounts, data exports, storage
 * objects). Each cleanup is a plain
 * provider with a `run(before)` method, so tests can call it without waiting for the schedule.
 */
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.maintenance })],
  providers: [
    AuthRecordsCleanup,
    OrphanObjectsCleanup,
    DeletedAccountsCleanup,
    AccountExportsCleanup,
    MaintenanceProcessor,
  ],
})
export class MaintenanceModule {}
