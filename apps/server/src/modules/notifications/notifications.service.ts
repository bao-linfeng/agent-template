import { Injectable, Logger } from '@nestjs/common'
import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  type SQL,
} from 'drizzle-orm'
import { z } from 'zod'
import { pageOffset, type Paginated } from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { isForeignKeyViolation } from '../../database/errors.js'
import type { NotificationRow } from '../../database/schema/index.js'
import { MailService, type MailJob } from '../../infra/mail/mail.service.js'
import type { Realm } from '../auth/realms.js'
import type { ListNotificationsQueryDto } from './dto/notification.dto.js'
import { NotificationStreamService } from './notification-stream.service.js'
import { NOTIFICATION_TABLES } from './notification-tables.js'
import {
  categoriesFor,
  isNotificationCategory,
  isNotificationType,
  NOTIFICATION_CATEGORIES,
  notificationTypeDefinition,
  renderTemplate,
  typesOf,
  type HasEmail,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationParams,
  type NotificationRealm,
  type NotificationType,
} from './notifications.catalog.js'

export interface NotificationView {
  id: string
  type: string
  /** Null for types the running release does not know (written by a newer one). */
  category: NotificationCategory | null
  params: Record<string, unknown>
  /** English fallback rendered from the catalog; clients translate `notifications.types.<type>`. */
  title: string
  body: string
  link: string | null
  readAt: Date | null
  createdAt: Date
}

export interface PreferenceView {
  category: NotificationCategory
  /** Mandatory categories are always delivered; their switches cannot be turned off. */
  mandatory: boolean
  description: string
  /** Effective switch per channel the category uses in this realm. */
  channels: Partial<Record<NotificationChannel, boolean>>
}

export type NotifyInput<T extends NotificationType> = {
  realm: NotificationRealm<T>
  /** `users.id` or `admin_users.id` depending on `realm`. */
  recipientId: string
  type: T
  params: NotificationParams<T>
  /** Overrides the type's default link (an app route starting with `/`). */
  link?: string
} & (HasEmail<T> extends true
  ? /** The email of the type (`to` + a template from `mail.templates.ts`), sent unless switched off. */
    { mail: MailJob }
  : { mail?: never })

const preferenceChanges = z.record(
  z.string(),
  z.record(z.string(), z.boolean()),
)

/**
 * Personal notifications of both realms: delivery (`notify`), the inbox (list, unread count, read,
 * delete) and per-category channel preferences. Announcements live in `AnnouncementsService`.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectDb() private readonly db: Database,
    private readonly mail: MailService,
    private readonly streams: NotificationStreamService,
  ) {}

  /**
   * Delivers a notification on the channels of its type that the recipient has not switched off
   * (mandatory categories ignore preferences): stores it and signals the recipient's open streams
   * (`inApp`), queues `mail` (`email`). Call it after the change it reports has been committed. A
   * recipient deleted meanwhile is skipped. Invalid params or realms are programming errors and throw.
   */
  async notify<T extends NotificationType>(
    input: NotifyInput<T>,
  ): Promise<void> {
    const { realm, recipientId, type } = input
    const definition = notificationTypeDefinition(type)
    if (!definition.realms.includes(realm)) {
      throw new Error(
        `Notification type "${type}" is not sent to ${realm} accounts`,
      )
    }
    const params = definition.params.parse(input.params) as Record<
      string,
      unknown
    >
    const link =
      input.link ?? (definition.link as Partial<Record<Realm, string>>)?.[realm]
    if (link !== undefined && !/^\/(?!\/)/.test(link)) {
      throw new Error(`Notification link must be an app route: ${link}`)
    }
    const enabled = await this.enabledChannels(
      realm,
      recipientId,
      definition.category,
    )

    if (definition.channels.includes('inApp') && enabled('inApp')) {
      const { notifications } = NOTIFICATION_TABLES[realm]
      let row: NotificationRow | undefined
      try {
        ;[row] = await this.db
          .insert(notifications)
          .values({ recipientId, type, params, link })
          .returning()
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          return
        }
        throw error
      }
      await this.streams.publish(realm, recipientId, {
        event: 'notification',
        data: toView(row!),
      })
    }
    if (definition.channels.includes('email') && enabled('email')) {
      if (!input.mail) {
        throw new Error(`Notification type "${type}" needs the rendered mail`)
      }
      const { to, ...mail } = input.mail
      await this.mail.send(to, mail)
    }
  }

  /** Newest first. */
  async list(
    realm: Realm,
    accountId: string,
    query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationView>> {
    const { notifications } = NOTIFICATION_TABLES[realm]
    const conditions: SQL[] = [eq(notifications.recipientId, accountId)]
    if (query.unread) {
      conditions.push(isNull(notifications.readAt))
    }
    if (query.category) {
      conditions.push(inArray(notifications.type, typesOf(query.category)))
    }
    const where = and(...conditions)
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(notifications).where(where),
    ])
    return {
      items: rows.map(toView),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async unreadCount(realm: Realm, accountId: string): Promise<number> {
    const { notifications } = NOTIFICATION_TABLES[realm]
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, accountId),
          isNull(notifications.readAt),
        ),
      )
    return total
  }

  /** 404 `NOTIFICATION_NOT_FOUND` for missing ones and those of other accounts. Reading twice keeps the first time. */
  async markRead(realm: Realm, accountId: string, id: string): Promise<void> {
    const { notifications } = NOTIFICATION_TABLES[realm]
    const own = and(
      eq(notifications.id, id),
      eq(notifications.recipientId, accountId),
    )
    const [updated] = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(own, isNull(notifications.readAt)))
      .returning({ id: notifications.id })
    if (!updated) {
      const [existing] = await this.db
        .select({ id: notifications.id })
        .from(notifications)
        .where(own)
        .limit(1)
      if (!existing) {
        throw new AppException('NOTIFICATION_NOT_FOUND')
      }
      return
    }
    await this.streams.publish(realm, accountId, {
      event: 'sync',
      data: { reason: 'read' },
    })
  }

  /** Returns how many notifications were unread. */
  async markAllRead(realm: Realm, accountId: string): Promise<number> {
    const { notifications } = NOTIFICATION_TABLES[realm]
    const result = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.recipientId, accountId),
          isNull(notifications.readAt),
        ),
      )
    const updated = result.rowCount ?? 0
    if (updated > 0) {
      await this.streams.publish(realm, accountId, {
        event: 'sync',
        data: { reason: 'read' },
      })
    }
    return updated
  }

  async remove(realm: Realm, accountId: string, id: string): Promise<void> {
    const { notifications } = NOTIFICATION_TABLES[realm]
    const [deleted] = await this.db
      .delete(notifications)
      .where(
        and(eq(notifications.id, id), eq(notifications.recipientId, accountId)),
      )
      .returning({ id: notifications.id })
    if (!deleted) {
      throw new AppException('NOTIFICATION_NOT_FOUND')
    }
    await this.streams.publish(realm, accountId, {
      event: 'sync',
      data: { reason: 'deleted' },
    })
  }

  // ---- Preferences -------------------------------------------------------------------------

  async preferences(
    realm: Realm,
    accountId: string,
  ): Promise<PreferenceView[]> {
    const { preferences } = NOTIFICATION_TABLES[realm]
    const rows = await this.db
      .select()
      .from(preferences)
      .where(eq(preferences.accountId, accountId))
    const stored = new Map(rows.map((row) => [row.category, row.channels]))
    return categoriesFor(realm).map((category) => ({
      category: category.category,
      mandatory: category.mandatory,
      description: category.description,
      channels: Object.fromEntries(
        category.channels.map((channel) => [
          channel,
          category.mandatory ||
            stored.get(category.category)?.[channel] !== false,
        ]),
      ),
    }))
  }

  /**
   * Applies `{ <category>: { <channel>: boolean } }` atomically and returns the new state. 400
   * `NOTIFICATION_CATEGORY_UNKNOWN` for categories the realm does not have, `NOTIFICATION_CATEGORY_MANDATORY`
   * when switching off a mandatory one, `NOTIFICATION_PREFERENCE_INVALID` for channels it does not use.
   */
  async updatePreferences(
    realm: Realm,
    accountId: string,
    changes: Record<string, unknown>,
  ): Promise<PreferenceView[]> {
    const parsed = preferenceChanges.safeParse(changes)
    if (!parsed.success) {
      throw new AppException('NOTIFICATION_PREFERENCE_INVALID', {
        details: parsed.error.issues.map(({ code, message, path }) => ({
          code,
          message,
          path: path.join('.'),
        })),
      })
    }
    const categories = new Map(
      categoriesFor(realm).map((category) => [category.category, category]),
    )
    const writes: { category: string; channels: Record<string, boolean> }[] = []
    for (const [key, channels] of Object.entries(parsed.data)) {
      const category = isNotificationCategory(key)
        ? categories.get(key)
        : undefined
      if (!category) {
        throw new AppException('NOTIFICATION_CATEGORY_UNKNOWN', {
          params: { category: key },
        })
      }
      for (const [channel, value] of Object.entries(channels)) {
        if (!(category.channels as string[]).includes(channel)) {
          throw new AppException('NOTIFICATION_PREFERENCE_INVALID', {
            params: { category: key, channel },
          })
        }
        if (category.mandatory && !value) {
          throw new AppException('NOTIFICATION_CATEGORY_MANDATORY', {
            params: { category: key },
          })
        }
      }
      if (!category.mandatory && Object.keys(channels).length > 0) {
        writes.push({ category: key, channels })
      }
    }

    if (writes.length > 0) {
      const { preferences } = NOTIFICATION_TABLES[realm]
      try {
        await this.db
          .insert(preferences)
          .values(writes.map((write) => ({ accountId, ...write })))
          .onConflictDoUpdate({
            target: [preferences.accountId, preferences.category],
            // Merges per channel, so concurrent changes of different channels both stay.
            set: {
              channels: sql`${preferences.channels} || excluded.channels`,
              updatedAt: sql`now()`,
            },
          })
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          throw new AppException('ACCOUNT_NOT_FOUND')
        }
        throw error
      }
      await this.streams.publish(realm, accountId, {
        event: 'sync',
        data: { reason: 'preferences' },
      })
    }
    return this.preferences(realm, accountId)
  }

  private async enabledChannels(
    realm: Realm,
    accountId: string,
    category: NotificationCategory,
  ): Promise<(channel: NotificationChannel) => boolean> {
    if (NOTIFICATION_CATEGORIES[category].mandatory) {
      return () => true
    }
    const { preferences } = NOTIFICATION_TABLES[realm]
    const [row] = await this.db
      .select({ channels: preferences.channels })
      .from(preferences)
      .where(
        and(
          eq(preferences.accountId, accountId),
          eq(preferences.category, category),
        ),
      )
      .limit(1)
    return (channel) => row?.channels[channel] !== false
  }
}

export function toView(row: NotificationRow): NotificationView {
  const known = isNotificationType(row.type)
    ? notificationTypeDefinition(row.type)
    : undefined
  return {
    id: row.id,
    type: row.type,
    category: known?.category ?? null,
    params: row.params,
    title: known ? renderTemplate(known.title, row.params) : row.type,
    body: known ? renderTemplate(known.body, row.params) : '',
    link: row.link,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}
