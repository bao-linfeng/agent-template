import { Injectable } from '@nestjs/common'
import { lt } from 'drizzle-orm'
import { deleteInBatches } from '../../database/batch-delete.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { REALMS } from '../auth/realms.js'
import { NOTIFICATION_TABLES } from '../notifications/notification-tables.js'

/**
 * Deletes personal notifications of both realms created before `before`, read or not. Announcements are
 * kept (administrators delete them); their read marks go with them or with the account.
 */
@Injectable()
export class NotificationsCleanup {
  constructor(@InjectDb() private readonly db: Database) {}

  async run(before: Date): Promise<number> {
    let deleted = 0
    for (const realm of REALMS) {
      const { notifications } = NOTIFICATION_TABLES[realm]
      deleted += await deleteInBatches(
        this.db,
        notifications,
        notifications.id,
        lt(notifications.createdAt, before),
      )
    }
    return deleted
  }
}
