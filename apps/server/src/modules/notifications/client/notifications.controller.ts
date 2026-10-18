import { ApiTags } from '@nestjs/swagger'
import { ClientController } from '../../auth/decorators.js'
import { AnnouncementsService } from '../announcements.service.js'
import { NotificationInboxController } from '../notification-inbox.controller.js'
import { NotificationStreamService } from '../notification-stream.service.js'
import { NotificationsService } from '../notifications.service.js'

/** Notifications, announcements and preferences of the signed-in client user. */
@ApiTags('client / notifications')
@ClientController('notifications')
export class ClientNotificationsController extends NotificationInboxController {
  constructor(
    notifications: NotificationsService,
    announcements: AnnouncementsService,
    streams: NotificationStreamService,
  ) {
    super(notifications, announcements, streams)
  }
}
