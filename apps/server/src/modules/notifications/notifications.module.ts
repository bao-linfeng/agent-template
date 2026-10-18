import { Global, Module } from '@nestjs/common'
import { AnnouncementsController } from './admin/announcements.controller.js'
import { AdminNotificationsController } from './admin/notifications.controller.js'
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
  controllers: [
    ClientNotificationsController,
    AdminNotificationsController,
    AnnouncementsController,
  ],
  providers: [
    NotificationStreamService,
    NotificationsService,
    AnnouncementsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
