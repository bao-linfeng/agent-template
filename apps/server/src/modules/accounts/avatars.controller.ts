import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AppException } from '../../common/errors/app.exception.js'
import type { HttpReply } from '../../common/http/request.js'
import { StorageService } from '../../infra/storage/storage.service.js'
import { Public } from '../auth/decorators.js'
import {
  AVATAR_FILE_PATTERN,
  AVATAR_MIME_BY_EXT,
  avatarKey,
  type AvatarExtension,
} from './avatar.js'

@ApiTags('accounts')
@Controller('avatars')
export class AvatarsController {
  constructor(private readonly storage: StorageService) {}

  /** Public, immutable avatar images of both realms (`avatarUrl` in account payloads points here). */
  @Public()
  @Get(':accountId/:file')
  async get(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Param('file') file: string,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<StreamableFile> {
    if (!AVATAR_FILE_PATTERN.test(file)) {
      throw new AppException('FILE_NOT_FOUND')
    }
    const object = await this.storage.getObject(avatarKey(accountId, file))
    const ext = file.slice(file.lastIndexOf('.') + 1) as AvatarExtension
    reply.header('Cache-Control', 'public, max-age=31536000, immutable')
    return new StreamableFile(object.body, {
      type: AVATAR_MIME_BY_EXT[ext],
      length: object.contentLength,
    })
  }
}
