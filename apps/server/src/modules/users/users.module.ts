import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AccountsModule } from '../accounts/accounts.module.js'
import { AccountExportBuilder } from './account-export.builder.js'
import { AccountExportProcessor } from './account-export.processor.js'
import { AccountExportsService } from './account-exports.service.js'
import { AdminUsersController } from './admin/users.controller.js'
import { ExportsController } from './client/exports.controller.js'
import { MeController } from './client/me.controller.js'

/**
 * Client app accounts: `/v1/client/users/me` (profile, deletion request, data exports) for the user,
 * `/v1/admin/users` for administrators. Deleted accounts are purged by `modules/maintenance`.
 */
@Module({
  imports: [
    AccountsModule,
    BullModule.registerQueue({ name: QUEUES.accountExport }),
  ],
  controllers: [MeController, ExportsController, AdminUsersController],
  providers: [
    AccountExportsService,
    AccountExportBuilder,
    AccountExportProcessor,
  ],
})
export class UsersModule {}
