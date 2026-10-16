import { Controller, Get, HttpStatus, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { sql } from 'drizzle-orm'
import type { FastifyReply } from 'fastify'
import type { Redis } from 'ioredis'
import type { Database } from '../../database/database.js'
import { InjectDb } from '../../database/database.module.js'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { Public } from '../auth/decorators.js'

type CheckStatus = 'up' | 'down'

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectDb() private readonly db: Database,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /** Liveness: the process is serving requests. */
  @Get('live')
  live() {
    return { status: 'ok' }
  }

  /** Readiness: database and Redis respond. Returns 503 (same body, not an error body) when a dependency is down. */
  @Get()
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const [database, redis] = await Promise.all([
      this.check(() => this.db.execute(sql`select 1`)),
      this.check(() => this.redis.ping()),
    ])
    const body = {
      status: database === 'up' && redis === 'up' ? 'ok' : 'error',
      checks: { database, redis },
    }
    if (body.status !== 'ok') {
      void reply.status(HttpStatus.SERVICE_UNAVAILABLE)
    }
    return body
  }

  private async check(probe: () => Promise<unknown>): Promise<CheckStatus> {
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        probe(),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), 2_000)
        }),
      ])
      return 'up'
    } catch {
      return 'down'
    } finally {
      clearTimeout(timer)
    }
  }
}
