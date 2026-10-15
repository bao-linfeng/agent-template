import type { ThrottlerStorage } from '@nestjs/throttler'
import type { Redis } from 'ioredis'

// KEYS[1] = hit counter, KEYS[2] = block flag; ARGV = ttl ms, limit, block duration ms.
const INCREMENT_SCRIPT = `
local blockTtl = redis.call('PTTL', KEYS[2])
if blockTtl > 0 then
  return { tonumber(redis.call('GET', KEYS[1]) or ARGV[2]), redis.call('PTTL', KEYS[1]), 1, blockTtl }
end
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local hitsTtl = redis.call('PTTL', KEYS[1])
if hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  return { hits, hitsTtl, 1, tonumber(ARGV[3]) }
end
return { hits, hitsTtl, 0, 0 }
`

/** Shared rate-limit counters so limits hold across multiple API instances. */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'throttle',
  ) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): ReturnType<ThrottlerStorage['increment']> {
    const base = `${this.prefix}:${throttlerName}:${key}`
    const [totalHits, hitsTtl, isBlocked, blockTtl] = (await this.redis.eval(
      INCREMENT_SCRIPT,
      2,
      `${base}:hits`,
      `${base}:blocked`,
      ttl,
      limit,
      blockDuration > 0 ? blockDuration : ttl,
    )) as [number, number, number, number]
    return {
      totalHits,
      timeToExpire: Math.max(0, Math.ceil(hitsTtl / 1000)),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: Math.max(0, Math.ceil(blockTtl / 1000)),
    }
  }
}
