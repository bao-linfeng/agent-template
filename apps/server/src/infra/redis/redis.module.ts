import {
  Global,
  Inject,
  Injectable,
  Module,
  OnApplicationShutdown,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Redis } from 'ioredis'
import type { Env } from '../../config/env.js'
import { RedisLockService } from './redis-lock.service.js'

export const REDIS = Symbol('REDIS')

/** Injects the shared ioredis client for caching, rate limiting and short-lived state. */
export const InjectRedis = () => Inject(REDIS)

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit()
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Redis(config.get('REDIS_URL', { infer: true }), {
          lazyConnect: false,
          maxRetriesPerRequest: 3,
        }),
    },
    RedisShutdown,
    {
      provide: RedisLockService,
      inject: [REDIS],
      useFactory: (redis: Redis) => new RedisLockService(redis),
    },
  ],
  exports: [REDIS, RedisLockService],
})
export class RedisModule {}
