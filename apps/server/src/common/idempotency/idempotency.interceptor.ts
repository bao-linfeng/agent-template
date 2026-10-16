import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { randomUUID } from 'node:crypto'
import type { Redis } from 'ioredis'
import {
  catchError,
  concatMap,
  finalize,
  from,
  of,
  type Observable,
} from 'rxjs'
import { InjectRedis } from '../../infra/redis/redis.module.js'
import { sha256 } from '../crypto/crypto.js'
import { AppException } from '../errors/app.exception.js'
import type { HttpReply, HttpRequest } from '../http/request.js'
import {
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENT_KEY,
  IDEMPOTENT_REPLAYED_HEADER,
  parseIdempotencyKey,
  requestFingerprint,
  type IdempotencyOptions,
} from './idempotency.js'

const DEFAULT_TTL_SECONDS = 24 * 60 * 60
/** Lease of an in-flight request, renewed while it runs; frees the key when the instance dies. */
const PROCESSING_LEASE_MS = 30_000

// KEYS[1] = record; ARGV = fingerprint, token, lease ms. Claims the key, or returns the existing
// record as { fingerprint, state, body }.
const BEGIN_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 1 then
  return redis.call('HMGET', KEYS[1], 'fingerprint', 'state', 'body')
end
redis.call('HSET', KEYS[1], 'fingerprint', ARGV[1], 'state', 'processing', 'token', ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return false
`

// KEYS[1] = record; ARGV = token, body, ttl s. Stores the response if the caller still owns the key.
const COMPLETE_SCRIPT = `
if redis.call('HGET', KEYS[1], 'token') ~= ARGV[1] then
  return 0
end
redis.call('HSET', KEYS[1], 'state', 'done', 'body', ARGV[2])
redis.call('HDEL', KEYS[1], 'token')
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
`

// KEYS[1] = record; ARGV = token. Drops the key after a failure, if the caller still owns it.
const ABANDON_SCRIPT = `
if redis.call('HGET', KEYS[1], 'token') == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

// KEYS[1] = record; ARGV = token, lease ms.
const RENEW_SCRIPT = `
if redis.call('HGET', KEYS[1], 'token') == ARGV[1] then
  return redis.call('PEXPIRE', KEYS[1], ARGV[2])
end
return 0
`

/** Stored marker for handlers without a body (204). */
const EMPTY_BODY = ''

/**
 * Global interceptor behind `@Idempotent()` (see `idempotency.ts`). Records live in Redis under
 * `idempotency:<scope>:<sha256(key)>`; the scope is `<realm>:<accountId>` (or `ip:<ip>` on public
 * routes), so keys never collide across accounts. Runs after the guards, so unauthenticated and
 * forbidden requests never claim a key.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle()
    }
    const options = this.reflector.getAllAndOverride<
      IdempotencyOptions | undefined
    >(IDEMPOTENT_KEY, [context.getHandler(), context.getClass()])
    if (!options) {
      return next.handle()
    }
    const http = context.switchToHttp()
    const request = http.getRequest<HttpRequest>()
    const key = parseIdempotencyKey(request.headers[IDEMPOTENCY_KEY_HEADER])
    if (key === undefined) {
      if (options.required) {
        throw new AppException('IDEMPOTENCY_KEY_REQUIRED')
      }
      return next.handle()
    }

    const scope = request.user
      ? `${request.user.realm}:${request.user.id}`
      : `ip:${request.ip}`
    const recordKey = `idempotency:${scope}:${sha256(key)}`
    const fingerprint = requestFingerprint(
      request.method,
      request.url,
      request.body,
    )
    const token = randomUUID()
    const existing = (await this.redis.eval(
      BEGIN_SCRIPT,
      1,
      recordKey,
      fingerprint,
      token,
      PROCESSING_LEASE_MS,
    )) as [string | null, string | null, string | null] | null

    if (existing) {
      const [storedFingerprint, state, body] = existing
      if (storedFingerprint !== fingerprint) {
        throw new AppException('IDEMPOTENCY_KEY_MISMATCH')
      }
      if (state !== 'done') {
        throw new AppException('IDEMPOTENCY_KEY_IN_PROGRESS')
      }
      void http
        .getResponse<HttpReply>()
        .header(IDEMPOTENT_REPLAYED_HEADER, 'true')
      return of(!body ? undefined : JSON.parse(body))
    }

    const renewal = setInterval(() => {
      this.redis
        .eval(RENEW_SCRIPT, 1, recordKey, token, PROCESSING_LEASE_MS)
        .catch((error: unknown) => this.warn('renew', error))
    }, PROCESSING_LEASE_MS / 3)
    renewal.unref()
    const ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        const body = result === undefined ? EMPTY_BODY : JSON.stringify(result)
        await this.redis
          .eval(COMPLETE_SCRIPT, 1, recordKey, token, body, ttlSeconds)
          .catch((error: unknown) => this.warn('store', error))
        return result
      }),
      catchError((error: unknown) => {
        // Failed requests are not remembered: the client may retry them with the same key.
        return from(
          this.redis
            .eval(ABANDON_SCRIPT, 1, recordKey, token)
            .catch((cause: unknown) => this.warn('release', cause)),
        ).pipe(
          concatMap(() => {
            throw error
          }),
        )
      }),
      finalize(() => clearInterval(renewal)),
    )
  }

  private warn(action: string, error: unknown): void {
    this.logger.warn(
      `Failed to ${action} idempotency record: ${(error as Error).message}`,
    )
  }
}
