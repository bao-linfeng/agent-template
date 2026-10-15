import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Env } from '../../config/env.js'

/** Queue names. Register a queue with `BullModule.registerQueue({ name })` in the feature module. */
export const QUEUES = {
  mail: 'mail',
  ragIngest: 'rag-ingest',
} as const

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        // maxRetriesPerRequest: null is required by BullMQ workers (blocking commands).
        connection: {
          url: config.get('REDIS_URL', { infer: true }),
          maxRetriesPerRequest: null,
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
          removeOnFail: { age: 7 * 24 * 60 * 60 },
        },
      }),
    }),
  ],
})
export class QueueModule {}
