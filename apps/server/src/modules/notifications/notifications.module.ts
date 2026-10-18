import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { QUEUES } from '../../infra/queue/queue.module.js'
import { AnnouncementsController } from './admin/announcements.controller.js'
import { AdminNotificationsController } from './admin/notifications.controller.js'
import { AnnouncementSignalsProcessor } from './announcement-signals.processor.js'
import { AnnouncementsService } from './announcements.service.js'
import { ClientNotificationsController } from './client/notifications.controller.js'
import { NotificationStreamService } from './notification-stream.service.js'
import { NotificationsService } from './notifications.service.js'

/**
 * In-app notifications, email delivery by preference, announcements and the event stream. Global, so
 * feature modules inject `NotificationsService` to `notify` without importing this module (it only
 * depends on global infrastructure, never on feature modules).
 */
@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.notifications })],
  controllers: [
    ClientNotificationsController,
    AdminNotificationsController,
    AnnouncementsController,
  ],
  providers: [
    NotificationStreamService,
    NotificationsService,
    AnnouncementsService,
    AnnouncementSignalsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
