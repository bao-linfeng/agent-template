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
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../../../common/http/request.js'
import { AdminController, CurrentUser } from '../../auth/decorators.js'
import { RequirePermissions } from '../../rbac/policies.js'
import {
  AnnouncementsService,
  type AnnouncementView,
} from '../announcements.service.js'
import {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  PublishAnnouncementDto,
  UpdateAnnouncementDto,
} from '../dto/announcement.dto.js'

/**
 * Announcements to client users, admins or both. Visible to the audience (`.../notifications/announcements`)
 * from the publication time until they expire; publishing, edits, scheduled publication and expiry reach
 * open notification streams immediately.
 */
@ApiTags('admin / announcements')
@AdminController('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  /** Newest first; `keyword` matches the title. */
  @Get()
  @RequirePermissions('announcement:read')
  list(@Query() query: ListAnnouncementsQueryDto) {
    return this.announcements.list(query)
  }

  @Get(':id')
  @RequirePermissions('announcement:read')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AnnouncementView> {
    return this.announcements.get(id)
  }

  /**
   * A draft, published right away with `publish: true` or scheduled with `publishAt`. 400
   * `ANNOUNCEMENT_EXPIRY_INVALID` for a past `expiresAt`, `ANNOUNCEMENT_SCHEDULE_INVALID` for a `publishAt`
   * in the past, not before `expiresAt` or combined with `publish`.
   */
  @Post()
  @RequirePermissions('announcement:manage')
  create(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AnnouncementView> {
    return this.announcements.create(dto, actor.id)
  }

  @Patch(':id')
  @RequirePermissions('announcement:manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AnnouncementView> {
    return this.announcements.update(id, dto, actor.id)
  }

  /**
   * Now (no-op when already published), or at `publishAt` (also reschedules, and hides a published one
   * until then). 400 `ANNOUNCEMENT_EXPIRY_INVALID` once `expiresAt` has passed, `ANNOUNCEMENT_SCHEDULE_INVALID`
   * for a `publishAt` in the past or not before `expiresAt`.
   */
  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions('announcement:manage')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishAnnouncementDto,
    @CurrentUser() actor: AuthUser,
  ): Promise<AnnouncementView> {
    return this.announcements.publish(id, actor.id, dto.publishAt)
  }

  /** Back to a draft (hidden from the audience), also for a scheduled one. */
  @Post(':id/withdraw')
  @HttpCode(200)
  @RequirePermissions('announcement:manage')
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<AnnouncementView> {
    return this.announcements.withdraw(id, actor.id)
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('announcement:manage')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.announcements.remove(id)
  }
}
