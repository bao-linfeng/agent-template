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
  UpdateAnnouncementDto,
} from '../dto/announcement.dto.js'

/**
 * Announcements to client users, admins or both. Visible to the audience (`.../notifications/announcements`)
 * while published and not expired; publishing and edits reach open notification streams immediately.
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

  /** A draft, or published right away with `publish: true`. 400 `ANNOUNCEMENT_EXPIRY_INVALID` for a past `expiresAt`. */
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

  /** No-op when already published; 400 `ANNOUNCEMENT_EXPIRY_INVALID` once `expiresAt` has passed. */
  @Post(':id/publish')
  @HttpCode(200)
  @RequirePermissions('announcement:manage')
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthUser,
  ): Promise<AnnouncementView> {
    return this.announcements.publish(id, actor.id)
  }

  /** Back to a draft (hidden from the audience). */
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
