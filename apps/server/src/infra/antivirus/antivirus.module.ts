import { Global, Module } from '@nestjs/common'
import { AntivirusService } from './antivirus.service.js'

@Global()
@Module({
  providers: [AntivirusService],
  exports: [AntivirusService],
})
export class AntivirusModule {}
