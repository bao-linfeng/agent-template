import { BullModule } from '@nestjs/bullmq'
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createTransport } from 'nodemailer'
import type { Env } from '../../config/env.js'
import { QUEUES } from '../queue/queue.module.js'
import { MAIL_TRANSPORT, MailProcessor } from './mail.processor.js'
import { MailService } from './mail.service.js'

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUES.mail })],
  providers: [
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const user = config.get('SMTP_USER', { infer: true })
        const pass = config.get('SMTP_PASSWORD', { infer: true })
        return createTransport(
          {
            host: config.get('SMTP_HOST', { infer: true }),
            port: config.get('SMTP_PORT', { infer: true }),
            secure: config.get('SMTP_SECURE', { infer: true }),
            auth: user ? { user, pass } : undefined,
          },
          { from: config.get('MAIL_FROM', { infer: true }) },
        )
      },
    },
    MailService,
    MailProcessor,
  ],
  exports: [MailService],
})
export class MailModule {}
