import { Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Redis } from 'ioredis'
import { AppException } from '../../common/errors/app.exception.js'

export interface LockOptions {
  /** Lease in ms: a lock whose holder crashed frees itself after it. Default 30 s. */
  ttlMs?: number
  /** How long to wait for a busy lock before giving up; 0 (default) fails immediately. */
  waitMs?: number
  /** Delay between attempts while waiting (a little jitter is added). Default 100 ms. */
  retryDelayMs?: number
}

/** A held lock. Only the holder's token can extend or release it. */
export interface Lock {
  readonly key: string
  readonly token: string
  /** Resets the lease; `false` when the lock expired or was taken over meanwhile. */
  extend(ttlMs?: number): Promise<boolean>
  /** Frees the lock; `false` when it had already expired. */
  release(): Promise<boolean>
}

const DEFAULT_TTL_MS = 30_000
const DEFAULT_RETRY_DELAY_MS = 100
const KEY_PREFIX = 'lock:'

// KEYS[1] = lock; ARGV[1] = token. Deletes the lock only while the caller still holds it.
const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

// KEYS[1] = lock; ARGV = token, ttl ms. Resets the lease only while the caller still holds it.
const EXTEND_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`

/**
 * Mutual exclusion across API instances and workers (single Redis, `SET NX PX` + token-checked
 * release). Use it to serialize work on one resource, e.g. one running reply per conversation or one
 * ingest per document. Locks are leases: keep critical sections short or use `withLock`, which renews
 * the lease while the task runs. This is not a fencing mechanism; writes that must never overlap
 * also need a database constraint or transaction. Provided (and exported) by the global `RedisModule`.
 */
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name)

  constructor(private readonly redis: Redis) {}

  /** Takes the lock or returns `null` when it is still busy after `waitMs`. */
  async tryAcquire(
    key: string,
    options: LockOptions = {},
  ): Promise<Lock | null> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
    const deadline = Date.now() + (options.waitMs ?? 0)
    const redisKey = KEY_PREFIX + key
    const token = randomUUID()
    for (;;) {
      if ((await this.redis.set(redisKey, token, 'PX', ttlMs, 'NX')) === 'OK') {
        return this.handle(key, redisKey, token, ttlMs)
      }
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        return null
      }
      await sleep(
        Math.min(remaining, retryDelayMs + Math.random() * retryDelayMs),
      )
    }
  }

  /** Takes the lock; 409 `RESOURCE_LOCKED` when it is still busy after `waitMs`. */
  async acquire(key: string, options: LockOptions = {}): Promise<Lock> {
    const lock = await this.tryAcquire(key, options)
    if (!lock) {
      throw new AppException('RESOURCE_LOCKED')
    }
    return lock
  }

  /**
   * Runs `task` while holding the lock and releases it afterwards; 409 `RESOURCE_LOCKED` when the
   * lock stays busy for `waitMs`. The lease is renewed every third of `ttlMs` while the task runs, so
   * `ttlMs` only bounds how long a crashed holder blocks others. `signal` aborts if the lease is lost
   * (e.g. Redis was unreachable for longer than `ttlMs`); long tasks should stop when it fires.
   */
  async withLock<T>(
    key: string,
    task: (signal: AbortSignal) => Promise<T>,
    options: LockOptions = {},
  ): Promise<T> {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
    const lock = await this.acquire(key, { ...options, ttlMs })
    const controller = new AbortController()
    const renewal = setInterval(
      () => {
        lock.extend(ttlMs).then(
          (held) => {
            if (!held) {
              controller.abort(new Error(`Lock ${key} was lost`))
            }
          },
          (error: unknown) =>
            this.logger.warn(
              `Renewing lock ${key} failed: ${(error as Error).message}`,
            ),
        )
      },
      Math.max(Math.floor(ttlMs / 3), 1),
    )
    renewal.unref()
    try {
      return await task(controller.signal)
    } finally {
      clearInterval(renewal)
      await lock.release().catch((error: unknown) =>
        // The lease expires on its own; a failed release only delays the next holder.
        this.logger.warn(
          `Releasing lock ${key} failed: ${(error as Error).message}`,
        ),
      )
    }
  }

  private handle(
    key: string,
    redisKey: string,
    token: string,
    defaultTtlMs: number,
  ): Lock {
    const redis = this.redis
    return {
      key,
      token,
      async extend(ttlMs = defaultTtlMs) {
        return (
          (await redis.eval(EXTEND_SCRIPT, 1, redisKey, token, ttlMs)) === 1
        )
      },
      async release() {
        return (await redis.eval(RELEASE_SCRIPT, 1, redisKey, token)) === 1
      },
    }
  }
}
