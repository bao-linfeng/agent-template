import {
  Body,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiBody, ApiConsumes } from '@nestjs/swagger'
import { readSingleFile } from '../../common/http/multipart.js'
import type { AuthUser, HttpRequest } from '../../common/http/request.js'
import type { Env } from '../../config/env.js'
import { CurrentUser } from '../auth/decorators.js'
import { SessionsService } from '../auth/sessions.service.js'
import { AccountsService } from './accounts.service.js'
import { ChangePasswordDto, UpdateProfileDto } from './dto/account.dto.js'

const fileUploadBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
}

/**
 * Self-service routes of the signed-in account (profile, avatar, password, sessions), shared by
 * `/v1/client/users/me` (client) and `/v1/admin/me` (admin console). Subclasses add the controller decorator and
 * decide what the profile contains. The realm comes from the session (`user.realm`), which the auth
 * guard has already matched against the controller's realm.
 */
export abstract class AccountMeController<Profile> {
  constructor(
    protected readonly accounts: AccountsService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  protected abstract profile(user: AuthUser): Promise<Profile>

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.profile(user)
  }

  @Patch()
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<Profile> {
    await this.accounts.updateProfile(user.realm, user.id, dto)
    return this.profile(user)
  }

  @Put('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileUploadBody)
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @Req() request: HttpRequest,
  ): Promise<Profile> {
    const file = await readSingleFile(
      request,
      this.config.get('AVATAR_MAX_BYTES', { infer: true }),
    )
    await this.accounts.setAvatar(user.realm, user.id, file.buffer)
    return this.profile(user)
  }

  @Delete('avatar')
  async removeAvatar(@CurrentUser() user: AuthUser): Promise<Profile> {
    await this.accounts.removeAvatar(user.realm, user.id)
    return this.profile(user)
  }

  /** Signs out all other sessions on success. */
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.accounts.changePassword(
      user.realm,
      user.id,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
    )
  }

  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthUser) {
    const sessions = await this.sessions.listActive(user.realm, user.id)
    return sessions.map((session) => ({
      ...session,
      current: session.id === user.sessionId,
    }))
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    if (!(await this.sessions.revokeOwn(user.realm, user.id, id))) {
      throw new NotFoundException('Session not found')
    }
  }
}
