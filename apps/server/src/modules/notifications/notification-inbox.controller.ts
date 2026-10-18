import type { PassThrough } from 'node:stream'
import {
  Body,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common'
import { ApiOkResponse, ApiProduces } from '@nestjs/swagger'
import {
  PaginationQueryDto,
  type Paginated,
} from '../../common/dto/pagination.dto.js'
import type { AuthUser, HttpReply } from '../../common/http/request.js'
import { Audit } from '../audit/audit-context.js'
import { CurrentUser } from '../auth/decorators.js'
import {
  AnnouncementsService,
  type InboxAnnouncementView,
} from './announcements.service.js'
import {
  ListNotificationsQueryDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto.js'
import { NotificationStreamService } from './notification-stream.service.js'
import {
  NotificationsService,
  type NotificationView,
  type PreferenceView,
} from './notifications.service.js'

/**
 * Inbox of the signed-in account, shared by `/v1/client/notifications` and `/v1/admin/notifications`:
 * personal notifications, the realm's announcements, channel preferences and the event stream.
 * Subclasses add the realm controller decorator; the realm comes from the session.
 */
export abstract class NotificationInboxController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly announcements: AnnouncementsService,
    private readonly streams: NotificationStreamService,
  ) {}

  /** Personal notifications, newest first. */
  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<Paginated<NotificationView>> {
    return this.notifications.list(user.realm, user.id, query)
  }

  /** Unread personal notifications and announcements (for the badge). */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthUser) {
    const [notifications, announcements] = await Promise.all([
      this.notifications.unreadCount(user.realm, user.id),
      this.announcements.unreadCount(user.realm, user.id),
    ])
    return {
      notifications,
      announcements,
      total: notifications + announcements,
    }
  }

  /**
   * Server-sent events (`text/event-stream`): `ready` on connect, `notification` (a new one, full view),
   * `announcement` (`{ id }`, the realm's announcements changed) and `sync` (read state or preferences
   * changed elsewhere), plus `: ping` comments every 25 s. Refetch after `ready` and on every event.
   * The stream ends when the access token would expire or the session is revoked; reconnect (refreshing
   * the session on 401). Cookie clients and bearer clients (`Authorization`) use the same route.
   */
  @Get('stream')
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description: 'Server-sent events, one `event:`/`data:` frame per event',
    schema: { type: 'string' },
  })
  @Audit({ mode: 'failures' })
  stream(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<PassThrough> {
    reply.header('Content-Type', 'text/event-stream; charset=utf-8')
    reply.header('Cache-Control', 'no-cache, no-transform')
    // Tells nginx-like proxies not to buffer (Caddy flushes event streams on its own).
    reply.header('X-Accel-Buffering', 'no')
    return this.streams.open(user, reply)
  }

  @Post('read-all')
  @HttpCode(200)
  @Audit({ mode: 'failures' })
  async markAllRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number }> {
    return {
      updated: await this.notifications.markAllRead(user.realm, user.id),
    }
  }

  /** Categories of the realm with the effective switch of each channel they use. */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser): Promise<PreferenceView[]> {
    return this.notifications.preferences(user.realm, user.id)
  }

  /**
   * 400 `NOTIFICATION_CATEGORY_UNKNOWN` (`params.category`), `NOTIFICATION_CATEGORY_MANDATORY` when
   * switching off a mandatory category, `NOTIFICATION_PREFERENCE_INVALID` for other invalid values.
   */
  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<PreferenceView[]> {
    return this.notifications.updatePreferences(
      user.realm,
      user.id,
      dto.preferences,
    )
  }

  /** Published, unexpired announcements of the realm, newest first, with `readAt` of this account. */
  @Get('announcements')
  announcementInbox(
    @CurrentUser() user: AuthUser,
    @Query() query: PaginationQueryDto,
  ): Promise<Paginated<InboxAnnouncementView>> {
    return this.announcements.inbox(user.realm, user.id, query)
  }

  @Post('announcements/read-all')
  @HttpCode(200)
  @Audit({ mode: 'failures' })
  async markAllAnnouncementsRead(
    @CurrentUser() user: AuthUser,
  ): Promise<{ updated: number }> {
    return {
      updated: await this.announcements.markAllRead(user.realm, user.id),
    }
  }

  /** 404 `ANNOUNCEMENT_NOT_FOUND` unless it is visible to this account. */
  @Post('announcements/:id/read')
  @HttpCode(204)
  @Audit({ mode: 'failures' })
  async markAnnouncementRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.announcements.markRead(user.realm, user.id, id)
  }

  /** 404 `NOTIFICATION_NOT_FOUND` for missing ones and those of other accounts. */
  @Post(':id/read')
  @HttpCode(204)
  @Audit({ mode: 'failures' })
  async markRead(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notifications.markRead(user.realm, user.id, id)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.notifications.remove(user.realm, user.id, id)
  }
}
