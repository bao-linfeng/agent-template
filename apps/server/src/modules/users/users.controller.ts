import {
  Body,
  Controller,
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
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { readSingleFile } from '../../common/http/multipart.js';
import type {
  AuthUser,
  HttpReply,
  HttpRequest,
} from '../../common/http/request.js';
import type { Env } from '../../config/env.js';
import { StorageService } from '../../infra/storage/storage.service.js';
import { CurrentUser, Public } from '../auth/decorators.js';
import { SessionsService } from '../auth/sessions.service.js';
import {
  AVATAR_FILE_PATTERN,
  AVATAR_MIME_BY_EXT,
  avatarKey,
  type AvatarExtension,
} from './avatar.js';
import { ChangePasswordDto, UpdateProfileDto } from './dto/user.dto.js';
import { UsersService } from './users.service.js';

const fileUploadBody = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
};

@ApiTags('users')
@Controller('users/me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Profile plus role codes and permission codes (use them to build menus on the client). */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.getProfile(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.id, dto);
  }

  @Put('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileUploadBody)
  async uploadAvatar(
    @CurrentUser() user: AuthUser,
    @Req() request: HttpRequest,
  ) {
    const file = await readSingleFile(
      request,
      this.config.get('AVATAR_MAX_BYTES', { infer: true }),
    );
    return this.users.setAvatar(user.id, file.buffer);
  }

  @Delete('avatar')
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.users.removeAvatar(user.id);
  }

  /** Signs out all other sessions on success. */
  @Post('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.users.changePassword(
      user.id,
      user.sessionId,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Get('sessions')
  async listSessions(@CurrentUser() user: AuthUser) {
    const sessions = await this.sessions.listActive(user.id);
    return sessions.map((session) => ({
      ...session,
      current: session.id === user.sessionId,
    }));
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!(await this.sessions.revokeOwn(user.id, id))) {
      throw new NotFoundException('Session not found');
    }
  }
}

@ApiTags('users')
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly storage: StorageService) {}

  /** Public, immutable avatar images (`avatarUrl` in user payloads points here). */
  @Public()
  @Get(':userId/:file')
  async get(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<StreamableFile> {
    if (!AVATAR_FILE_PATTERN.test(file)) {
      throw new NotFoundException('File not found');
    }
    const object = await this.storage.getObject(avatarKey(userId, file));
    const ext = file.slice(file.lastIndexOf('.') + 1) as AvatarExtension;
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return new StreamableFile(object.body, {
      type: AVATAR_MIME_BY_EXT[ext],
      length: object.contentLength,
    });
  }
}
