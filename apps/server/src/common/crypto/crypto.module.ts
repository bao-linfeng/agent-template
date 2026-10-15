import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';
import { SecretBox } from './crypto.js';

@Global()
@Module({
  providers: [
    {
      provide: SecretBox,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SecretBox(config.get('ENCRYPTION_KEY', { infer: true })),
    },
  ],
  exports: [SecretBox],
})
export class CryptoModule {}
