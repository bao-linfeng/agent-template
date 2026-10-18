import {
  adminAnnouncementReads,
  adminNotificationPreferences,
  adminNotifications,
  userAnnouncementReads,
  userNotificationPreferences,
  userNotifications,
} from '../../database/schema/index.js'
import type { Realm } from '../auth/realms.js'

export interface NotificationTables {
  notifications: typeof userNotifications
  preferences: typeof userNotificationPreferences
  announcementReads: typeof userAnnouncementReads
}

/**
 * Per-realm tables of the notification module. The admin tables come from the same factories
 * (`schema/notifications.ts`), so the casts only erase the table-name literal (like `REALM_TABLES`).
 */
export const NOTIFICATION_TABLES: Record<Realm, NotificationTables> = {
  user: {
    notifications: userNotifications,
    preferences: userNotificationPreferences,
    announcementReads: userAnnouncementReads,
  },
  admin: {
    notifications: adminNotifications as unknown as typeof userNotifications,
    preferences:
      adminNotificationPreferences as unknown as typeof userNotificationPreferences,
    announcementReads:
      adminAnnouncementReads as unknown as typeof userAnnouncementReads,
  },
}
