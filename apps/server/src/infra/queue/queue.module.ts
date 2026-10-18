import { BullModule } from '@nestjs/bullmq'
import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BullMQOtel } from 'bullmq-otel'
import type { Env } from '../../config/env.js'

/** Queue names. Register a queue with `BullModule.registerQueue({ name })` in the feature module. */
export const QUEUES = {
  mail: 'mail',
  ragIngest: 'rag-ingest',
  audit: 'audit',
  maintenance: 'maintenance',
  accountExport: 'account-export',
  notifications: 'notifications',
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
        // Producer/consumer spans; jobs carry the trace context, so a job continues the request's trace.
        telemetry: config.get('TRACING_ENABLED', { infer: true })
          ? new BullMQOtel({ tracerName: 'bullmq' })
          : undefined,
      }),
    }),
  ],
})
export class QueueModule {}
