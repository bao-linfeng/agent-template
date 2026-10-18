import { Injectable } from '@nestjs/common'
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import {
  likePattern,
  pageOffset,
  type Paginated,
  type PaginationQueryDto,
} from '../../common/dto/pagination.dto.js'
import { AppException } from '../../common/errors/app.exception.js'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { isForeignKeyViolation } from '../../database/errors.js'
import {
  adminAnnouncementReads,
  announcements,
  userAnnouncementReads,
  type AnnouncementAudience,
  type AnnouncementLevel,
  type AnnouncementRow,
} from '../../database/schema/index.js'
import type { Realm } from '../auth/realms.js'
import type {
  AnnouncementStatus,
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  UpdateAnnouncementDto,
} from './dto/announcement.dto.js'
import { NotificationStreamService } from './notification-stream.service.js'
import { NOTIFICATION_TABLES } from './notification-tables.js'

/** Administration view (`/v1/admin/announcements`). */
export interface AnnouncementView {
  id: string
  title: string
  body: string
  level: AnnouncementLevel
  audience: AnnouncementAudience
  status: AnnouncementStatus
  publishedAt: Date | null
  expiresAt: Date | null
  createdBy: string | null
  updatedBy: string | null
  /** Accounts of the audience that have read it. */
  readCount: number
  createdAt: Date
  updatedAt: Date
}

/** What an account of the audience sees (`.../notifications/announcements`). */
export interface InboxAnnouncementView {
  id: string
  title: string
  body: string
  level: AnnouncementLevel
  publishedAt: Date
  expiresAt: Date | null
  readAt: Date | null
}

const REALM_AUDIENCES: Record<Realm, AnnouncementAudience[]> = {
  user: ['all', 'user'],
  admin: ['all', 'admin'],
}
const AUDIENCE_REALMS: Record<AnnouncementAudience, Realm[]> = {
  all: ['user', 'admin'],
  user: ['user'],
  admin: ['admin'],
}

function statusOf(row: AnnouncementRow, now = new Date()): AnnouncementStatus {
  if (!row.publishedAt) {
    return 'draft'
  }
  return row.expiresAt && row.expiresAt <= now ? 'expired' : 'published'
}

/** Published, not expired. */
function isVisible(row: AnnouncementRow, now = new Date()): boolean {
  return statusOf(row, now) === 'published'
}

function visibleTo(realm: Realm, now: Date): SQL {
  return and(
    inArray(announcements.audience, REALM_AUDIENCES[realm]),
    isNotNull(announcements.publishedAt),
    lte(announcements.publishedAt, now),
    or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
  )!
}

const readCount = sql<number>`(
  (select count(*) from ${userAnnouncementReads} where ${userAnnouncementReads.announcementId} = ${announcements.id})
  + (select count(*) from ${adminAnnouncementReads} where ${adminAnnouncementReads.announcementId} = ${announcements.id})
)::int`

/**
 * Announcements to every account of a realm (or both), written in the admin console. Stored once and
 * matched by audience when read; per-account read marks live in `*_announcement_reads`. Publishing,
 * editing a published one, withdrawing and deleting signal the audience's open streams.
 */
@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly streams: NotificationStreamService,
  ) {}

  // ---- Administration ----------------------------------------------------------------------

  /** Newest first; `keyword` matches the title. */
  async list(
    query: ListAnnouncementsQueryDto,
  ): Promise<Paginated<AnnouncementView>> {
    const now = new Date()
    const conditions: (SQL | undefined)[] = []
    if (query.status === 'draft') {
      conditions.push(isNull(announcements.publishedAt))
    } else if (query.status === 'published') {
      conditions.push(
        isNotNull(announcements.publishedAt),
        or(isNull(announcements.expiresAt), gt(announcements.expiresAt, now)),
      )
    } else if (query.status === 'expired') {
      conditions.push(
        isNotNull(announcements.publishedAt),
        lte(announcements.expiresAt, now),
      )
    }
    if (query.audience) {
      conditions.push(eq(announcements.audience, query.audience))
    }
    if (query.keyword) {
      conditions.push(ilike(announcements.title, likePattern(query.keyword)))
    }
    const where = and(...conditions)
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({ announcement: announcements, readCount })
        .from(announcements)
        .where(where)
        .orderBy(desc(announcements.createdAt), desc(announcements.id))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(announcements).where(where),
    ])
    return {
      items: rows.map((row) => toView(row.announcement, row.readCount, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async get(id: string): Promise<AnnouncementView> {
    const [row] = await this.db
      .select({ announcement: announcements, readCount })
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1)
    if (!row) {
      throw new AppException('ANNOUNCEMENT_NOT_FOUND')
    }
    return toView(row.announcement, row.readCount)
  }

  async create(
    dto: CreateAnnouncementDto,
    adminUserId: string,
  ): Promise<AnnouncementView> {
    assertFutureExpiry(dto.expiresAt)
    const [created] = await this.db
      .insert(announcements)
      .values({
        title: dto.title,
        body: dto.body,
        level: dto.level,
        audience: dto.audience,
        expiresAt: dto.expiresAt,
        publishedAt: dto.publish ? new Date() : null,
        createdBy: adminUserId,
        updatedBy: adminUserId,
      })
      .returning()
    await this.signal(created!, created!)
    return toView(created!, 0)
  }

  /** Edits keep the publication state; a published one is signalled to its (old and new) audience again. */
  async update(
    id: string,
    dto: UpdateAnnouncementDto,
    adminUserId: string,
  ): Promise<AnnouncementView> {
    if (dto.expiresAt) {
      assertFutureExpiry(dto.expiresAt)
    }
    const before = await this.getRow(id)
    const [updated] = await this.db
      .update(announcements)
      .set({
        title: dto.title,
        body: dto.body,
        level: dto.level,
        audience: dto.audience,
        expiresAt: dto.expiresAt,
        updatedBy: adminUserId,
      })
      .where(eq(announcements.id, id))
      .returning()
    if (!updated) {
      throw new AppException('ANNOUNCEMENT_NOT_FOUND')
    }
    await this.signal(before, updated)
    return this.get(id)
  }

  /** Makes a draft visible now; publishing a published one changes nothing. 400 when it has expired. */
  async publish(id: string, adminUserId: string): Promise<AnnouncementView> {
    const before = await this.getRow(id)
    if (before.expiresAt && before.expiresAt <= new Date()) {
      throw new AppException('ANNOUNCEMENT_EXPIRY_INVALID')
    }
    if (!before.publishedAt) {
      const [published] = await this.db
        .update(announcements)
        .set({ publishedAt: new Date(), updatedBy: adminUserId })
        .where(and(eq(announcements.id, id), isNull(announcements.publishedAt)))
        .returning()
      if (published) {
        await this.signal(before, published)
      }
    }
    return this.get(id)
  }

  /** Turns it back into a draft (hidden); read marks are kept for a later republish. */
  async withdraw(id: string, adminUserId: string): Promise<AnnouncementView> {
    const before = await this.getRow(id)
    if (before.publishedAt) {
      const [withdrawn] = await this.db
        .update(announcements)
        .set({ publishedAt: null, updatedBy: adminUserId })
        .where(eq(announcements.id, id))
        .returning()
      if (withdrawn) {
        await this.signal(before, withdrawn)
      }
    }
    return this.get(id)
  }

  async remove(id: string): Promise<void> {
    const [deleted] = await this.db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning()
    if (!deleted) {
      throw new AppException('ANNOUNCEMENT_NOT_FOUND')
    }
    await this.signal(deleted, undefined)
  }

  // ---- Inbox of an account -----------------------------------------------------------------

  /** Visible announcements of the realm, newest first, with the account's read mark. */
  async inbox(
    realm: Realm,
    accountId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<InboxAnnouncementView>> {
    const { announcementReads: reads } = NOTIFICATION_TABLES[realm]
    const where = visibleTo(realm, new Date())
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: announcements.id,
          title: announcements.title,
          body: announcements.body,
          level: announcements.level,
          publishedAt: announcements.publishedAt,
          expiresAt: announcements.expiresAt,
          readAt: reads.readAt,
        })
        .from(announcements)
        .leftJoin(
          reads,
          and(
            eq(reads.announcementId, announcements.id),
            eq(reads.accountId, accountId),
          ),
        )
        .where(where)
        .orderBy(desc(announcements.publishedAt), desc(announcements.id))
        .limit(query.pageSize)
        .offset(pageOffset(query)),
      this.db.select({ total: count() }).from(announcements).where(where),
    ])
    return {
      items: rows.map((row) => ({ ...row, publishedAt: row.publishedAt! })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  async unreadCount(realm: Realm, accountId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(announcements)
      .where(and(visibleTo(realm, new Date()), this.unreadBy(realm, accountId)))
    return total
  }

  /** 404 `ANNOUNCEMENT_NOT_FOUND` unless it is visible to the account's realm. */
  async markRead(realm: Realm, accountId: string, id: string): Promise<void> {
    const [visible] = await this.db
      .select({ id: announcements.id })
      .from(announcements)
      .where(and(eq(announcements.id, id), visibleTo(realm, new Date())))
      .limit(1)
    if (!visible) {
      throw new AppException('ANNOUNCEMENT_NOT_FOUND')
    }
    await this.insertReads(realm, accountId, [id])
  }

  /** Marks every visible announcement as read; returns how many were unread. */
  async markAllRead(realm: Realm, accountId: string): Promise<number> {
    const unread = await this.db
      .select({ id: announcements.id })
      .from(announcements)
      .where(and(visibleTo(realm, new Date()), this.unreadBy(realm, accountId)))
    return this.insertReads(
      realm,
      accountId,
      unread.map((row) => row.id),
    )
  }

  private unreadBy(realm: Realm, accountId: string): SQL {
    const { announcementReads: reads } = NOTIFICATION_TABLES[realm]
    return notExists(
      this.db
        .select({ one: sql`1` })
        .from(reads)
        .where(
          and(
            eq(reads.announcementId, announcements.id),
            eq(reads.accountId, accountId),
          ),
        ),
    )
  }

  private async insertReads(
    realm: Realm,
    accountId: string,
    ids: string[],
  ): Promise<number> {
    if (ids.length === 0) {
      return 0
    }
    const { announcementReads: reads } = NOTIFICATION_TABLES[realm]
    let inserted: { id: string }[]
    try {
      inserted = await this.db
        .insert(reads)
        .values(ids.map((announcementId) => ({ accountId, announcementId })))
        .onConflictDoNothing()
        .returning({ id: reads.announcementId })
    } catch (error) {
      // The announcement was deleted meanwhile, or the account.
      if (isForeignKeyViolation(error)) {
        return 0
      }
      throw error
    }
    if (inserted.length > 0) {
      await this.streams.publish(realm, accountId, {
        event: 'sync',
        data: { reason: 'read' },
      })
    }
    return inserted.length
  }

  private async getRow(id: string): Promise<AnnouncementRow> {
    const [row] = await this.db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
      .limit(1)
    if (!row) {
      throw new AppException('ANNOUNCEMENT_NOT_FOUND')
    }
    return row
  }

  /** Signals the realms that saw it before or see it now; drafts and expired ones concern nobody. */
  private async signal(
    before: AnnouncementRow,
    after: AnnouncementRow | undefined,
  ): Promise<void> {
    const realms = new Set<Realm>()
    for (const row of [before, after]) {
      if (row && isVisible(row)) {
        AUDIENCE_REALMS[row.audience].forEach((realm) => realms.add(realm))
      }
    }
    if (realms.size > 0) {
      await this.streams.broadcast([...realms], {
        event: 'announcement',
        data: { id: before.id },
      })
    }
  }
}

function assertFutureExpiry(expiresAt: Date | undefined): void {
  if (expiresAt && expiresAt <= new Date()) {
    throw new AppException('ANNOUNCEMENT_EXPIRY_INVALID')
  }
}

function toView(
  row: AnnouncementRow,
  reads: number,
  now = new Date(),
): AnnouncementView {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    level: row.level,
    audience: row.audience,
    status: statusOf(row, now),
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    createdBy: row.createdBy,
    updatedBy: row.updatedBy,
    readCount: reads,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
