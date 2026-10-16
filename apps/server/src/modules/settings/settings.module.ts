import { Global, Module } from '@nestjs/common'
import { SettingsController } from './admin/settings.controller.js'
import { PublicSettingsController } from './client/public-settings.controller.js'
import { SettingsService } from './settings.service.js'

/** Global so any module can read runtime settings (`SettingsService.get`). */
@Global()
@Module({
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
