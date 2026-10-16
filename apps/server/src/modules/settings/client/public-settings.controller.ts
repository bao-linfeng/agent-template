import { Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ClientController, Public } from '../../auth/decorators.js'
import { SettingsService } from '../settings.service.js'

@ApiTags('client / settings')
@Public()
@ClientController('settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public settings keyed by setting key, e.g. `{ "auth.registrationEnabled": true }`; needs no session. */
  @Get()
  list() {
    return this.settings.publicValues()
  }
}
