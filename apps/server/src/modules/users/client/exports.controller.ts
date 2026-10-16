import {
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common'
import { ApiProduces, ApiTags } from '@nestjs/swagger'
import { PaginationQueryDto } from '../../../common/dto/pagination.dto.js'
import type { AuthUser, HttpReply } from '../../../common/http/request.js'
import { Idempotent } from '../../../common/idempotency/idempotency.js'
import { ClientController, CurrentUser } from '../../auth/decorators.js'
import {
  AccountExportsService,
  type AccountExportView,
} from '../account-exports.service.js'

/**
 * Personal data exports of the signed-in client user (profile, avatar, sessions, knowledge bases with
 * their documents, own audit trail) as one JSON file.
 */
@ApiTags('client / users')
@ClientController('users/me/exports')
export class ExportsController {
  constructor(private readonly exports: AccountExportsService) {}

  /**
   * Starts building an export (202, `status: pending`); poll it or wait for the email, then download
   * it. 409 `ACCOUNT_EXPORT_IN_PROGRESS` while another export is being built.
   */
  @Post()
  @HttpCode(202)
  @Idempotent()
  request(@CurrentUser() user: AuthUser): Promise<AccountExportView> {
    return this.exports.request(user.id)
  }

  /** Newest first; ready exports stay downloadable until `expiresAt`. */
  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.exports.list(user.id, query)
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AccountExportView> {
    return this.exports.get(user.id, id)
  }

  /** The JSON file; 409 `ACCOUNT_EXPORT_NOT_READY` before it is ready, 410 `ACCOUNT_EXPORT_EXPIRED` after `expiresAt`. */
  @Get(':id/download')
  @ApiProduces('application/json')
  async download(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) reply: HttpReply,
  ): Promise<StreamableFile> {
    const { object, filename } = await this.exports.download(user.id, id)
    reply.header('Cache-Control', 'private, no-store')
    return new StreamableFile(object.body, {
      type: 'application/json; charset=utf-8',
      length: object.contentLength,
      disposition: `attachment; filename="${filename}"`,
    })
  }
}
